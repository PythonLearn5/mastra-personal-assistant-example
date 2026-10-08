import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
  }[];
}
interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  // ⚠️ Mastra v1.x tool execute 签名变更：
  //   旧: execute({ input, context })  →  新: execute(inputData, context)
  execute: async (input) => {
    return await getWeather(input.location);
  },
});

const getWeather = async (location: string) => {
  // ---------------------------------------------------------------------------
  // Geocoding fallback chain:
  //   1. language=en  → 首选英文匹配（New York/London/Shanghai 全 OK，避免 "纽约" zh 误匹配为中国小村子）
  //   2. language=zh  → 中文汉字城市名回退（匹配 "上海, 北京, 深圳" 等中文原生输入）
  //   3. count=5 + population 排序 → 选人口最多的候选（避免 "约克小镇 US" 排到 "纽约市" 前面）
  // ---------------------------------------------------------------------------
  const searchLanguages: Array<string | undefined> = ["en", "zh", undefined];

  let best: { latitude: number; longitude: number; name: string } | null = null;
  let bestPop = -1;

  for (const lang of searchLanguages) {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=5` +
      (lang ? `&language=${lang}` : "");
    const resp = await fetch(url);
    const data = (await resp.json()) as GeocodingResponse;
    if (!data.results?.length) continue;

    for (const r of data.results) {
      const pop = (r as any).population ?? 0;
      // 相同结果时第一次匹配到的优先；若人口大则覆盖
      if (pop > bestPop) {
        bestPop = pop;
        best = { latitude: r.latitude, longitude: r.longitude, name: r.name };
      }
    }
    if (best) break;
  }

  if (!best) {
    throw new Error(`Location '${location}' not found`);
  }

  const { latitude, longitude, name } = best;

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}
