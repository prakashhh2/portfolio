// Current weather for Prakash's city from Open-Meteo (free, no API key, no visitor location used).

export const WEATHER_PLACE = { name: 'Hammond, LA', latitude: 30.5044, longitude: -90.4612 }
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_PLACE.latitude}&longitude=${WEATHER_PLACE.longitude}` +
  '&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America%2FChicago'
const CACHE_KEY = 'peteos.weather'
const MAX_AGE_MS = 15 * 60_000

export type Weather = { tempF: number; condition: string; fetchedAt: number }

// WMO weather codes, grouped.
function describe(code: number): string {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly cloudy'
  if (code === 3) return 'overcast'
  if (code <= 48) return 'fog'
  if (code <= 57) return 'drizzle'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain showers'
  if (code <= 86) return 'snow showers'
  return 'thunderstorm'
}

function readCache(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Weather) : null
  } catch {
    return null
  }
}

/** Returns cached weather if fresh, otherwise fetches. Falls back to stale cache, then null. */
export async function getWeather(): Promise<Weather | null> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached
  try {
    const res = await fetch(URL)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { current: { temperature_2m: number; weather_code: number } }
    const weather = { tempF: data.current.temperature_2m, condition: describe(data.current.weather_code), fetchedAt: Date.now() }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(weather))
    } catch {
      // storage blocked: just don't cache
    }
    return weather
  } catch {
    return cached
  }
}
