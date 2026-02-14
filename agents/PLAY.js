/**
 * ⬡B:ABCD:BOTH:AGENT.PLAY:v1.0.0:20260214⬡
 * PLAY - Performance and Live Activity Yielder
 * Department: LIFESTYLE
 * L3 Manager Agent
 */
const { httpsRequest } = require('../utils/http');

async function PLAY_getScores(query) {
  console.log('[PLAY] Sports query:', query);
  
  try {
    const result = await httpsRequest({
      hostname: 'site.api.espn.com',
      path: '/apis/site/v2/sports/basketball/nba/scoreboard',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.status === 200) {
      const data = JSON.parse(result.data.toString());
      const events = data.events || [];
      
      const queryLower = query.toLowerCase();
      
      for (const event of events) {
        const teams = event.competitions?.[0]?.competitors || [];
        for (const team of teams) {
          if (queryLower.includes(team.team?.name?.toLowerCase() || '')) {
            const homeTeam = teams.find(t => t.homeAway === 'home');
            const awayTeam = teams.find(t => t.homeAway === 'away');
            const status = event.status?.type?.description || 'Unknown';
            
            return `${awayTeam?.team?.name || 'Away'} ${awayTeam?.score || 0} - ${homeTeam?.team?.name || 'Home'} ${homeTeam?.score || 0}. Status: ${status}`;
          }
        }
      }
      
      if (events.length > 0) {
        const latest = events[0];
        const teams = latest.competitions?.[0]?.competitors || [];
        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');
        return `Latest game: ${awayTeam?.team?.name || 'Away'} ${awayTeam?.score || 0} - ${homeTeam?.team?.name || 'Home'} ${homeTeam?.score || 0}`;
      }
    }
    
    return 'I could not find current scores. The season might be in a break.';
  } catch (e) {
    console.log('[PLAY] Error:', e.message);
    return 'I had trouble checking the scores. Let me try again.';
  }
}

module.exports = { PLAY_getScores };
