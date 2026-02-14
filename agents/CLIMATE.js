/**
 * ⬡B:ABCD:BOTH:AGENT.CLIMATE:v1.0.0:20260214⬡
 * CLIMATE - Weather lookup agent
 * Department: LIFESTYLE
 * L3 Manager Agent
 */
const { httpsRequest } = require('../utils/http');

async function CLIMATE_getWeather(location) {
  console.log('[CLIMATE] Weather query for:', location);
  
  let lat = 36.0726;
  let lon = -79.7920;
  let cityName = 'Greensboro';
  
  const locLower = (location || '').toLowerCase();
  
  if (locLower.includes('greensboro') || locLower.includes('high point')) {
    lat = 36.0726; lon = -79.7920; cityName = 'Greensboro';
  } else if (locLower.includes('new york') || locLower.includes('nyc')) {
    lat = 40.7128; lon = -74.0060; cityName = 'New York';
  } else if (locLower.includes('los angeles') || locLower.includes('la')) {
    lat = 34.0522; lon = -118.2437; cityName = 'Los Angeles';
  }
  
  try {
    const result = await httpsRequest({
      hostname: 'api.open-meteo.com',
      path: `/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      const temp = Math.round(data.current?.temperature_2m || 0);
      const code = data.current?.weather_code || 0;
      
      let condition = 'clear';
      if (code >= 1 && code <= 3) condition = 'partly cloudy';
      else if (code >= 45 && code <= 48) condition = 'foggy';
      else if (code >= 51 && code <= 55) condition = 'drizzling';
      else if (code >= 61 && code <= 65) condition = 'rainy';
      else if (code >= 71 && code <= 77) condition = 'snowy';
      else if (code >= 80 && code <= 82) condition = 'showery';
      else if (code >= 95) condition = 'stormy';
      
      return `It is currently ${temp} degrees and ${condition} in ${cityName}.`;
    }
    
    return 'I could not get the weather right now.';
  } catch (e) {
    console.log('[CLIMATE] Error:', e.message);
    return 'I had trouble checking the weather.';
  }
}

module.exports = { CLIMATE_getWeather };
