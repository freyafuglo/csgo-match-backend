/**
 * parser.ts står for at omdanne de rå data til strukturerede og brugbare objekter.
 * analyzer.ts kan evt. senere implementeres for at opdele ansvaret mellem parsing og analysering af data (SRP).
 */

//omdanne timestamps til iso format
function parseCustomTimestamp(timestamp: string): Date | null {
  if (!timestamp) return null;

  // Split into date and time parts
  const [datePart, timePart] = timestamp.split(" - ");
  if (!datePart || !timePart) return null;

  // Extract month, day, year
  const [month, day, year] = datePart.split("/");
  if (!month || !day || !year) return null;

  // Build ISO string
  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0"
  )}T${timePart}Z`;

  return new Date(isoDate);
}

interface Kill {
  round: number;
  time: string;
  killer: string;
  victim: string;
  weapon: string;
}

interface Stats {
  averageRoundLength: number;
  totalKills: Record<string, number>;
  roundsWon: Record<string, number>;
  mostKillsInRound: number;
  deaths: Record<string, number>;
  bombPlants: number;
  bombDefuses: number;
  kills: Kill[];
}

function extractPlayerAndTeam(rawName: string): {
  player: string;
  team: "TERRORIST" | "CT" | null;
} {
  const teamMatch = rawName.match(/<(TERRORIST|CT)>/);
  const playerMatch = rawName.match(/^([^\<]+)/);

  return {
    player: playerMatch ? playerMatch[1] : rawName,
    team: teamMatch ? (teamMatch[1] as "TERRORIST" | "CT") : null,
  };
}

export async function parseMatchLog(
  url: string
): Promise<
  Stats & { groupedKills: Record<"TERRORIST" | "CT", Record<string, number>> }
> {
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.split("\n");

  // Finds last Match_Start line index
  let lastMatchStartIndex = -1;
  lines.forEach((line, i) => {
    if (line.includes('World triggered "Match_Start"')) {
      lastMatchStartIndex = i;
    }
  });

  const kills: Kill[] = [];
  const totalKills: Record<string, number> = {};
  const deaths: Record<string, number> = {};
  const roundsWon: Record<string, number> = { CT: 0, TERRORIST: 0 };
  let roundStartTime: Date | null = null;
  let totalRoundTime = 0;
  let roundCount = 0;
  let mostKillsInRound = 0;
  let bombPlants = 0;
  let bombDefuses = 0;
  let currentRoundKills = 0;

  //looper igennem log filen *EFTER* den sidste Match_Start linje forekommer
  for (let i = lastMatchStartIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    const timestampMatch = line.match(
      /(\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2})/
    );
    const time = timestampMatch ? timestampMatch[0] : "";

    // Round start
    if (line.includes('World triggered "Round_Start"')) {
      roundCount++;
      currentRoundKills = 0; //resetter mængden af kills for den runde
      if (timestampMatch) {
        roundStartTime = parseCustomTimestamp(timestampMatch[0]); //bruger manuel funktion til at omdanne til iso
      }
    }

    // Round end
    if (line.includes('World triggered "Round_End"') && roundStartTime) {
      if (timestampMatch) {
        const roundEndTime = parseCustomTimestamp(timestampMatch[0]);
        if (roundEndTime) {
          const roundTime =
            (roundEndTime.getTime() - roundStartTime.getTime()) / 1000;
          totalRoundTime += roundTime;
          mostKillsInRound = Math.max(mostKillsInRound, currentRoundKills);
          roundStartTime = null;
        }
      }
    }

    // Round win (generic match for any team)
    const winMatch = line.match(/Team "(CT|TERRORIST)" triggered ".*Win"/);
    if (winMatch) {
      const winningTeam = winMatch[1];
      roundsWon[winningTeam]++;
    }

    // Bomb plant
    if (line.includes('triggered "Bomb_Begin_Plant"')) {
      bombPlants++;
    }

    // Bomb defuse
    if (line.includes('triggered "Defused_The_Bomb"')) {
      bombDefuses++;
    }

    // Kill event
    if (line.includes("killed")) {
      const killRegex =
        /"([^"]+)" \[[^\]]+\] killed (?:other )?"([^"]+)" \[[^\]]+\] with "([^"]+)"/;
      const killMatch = line.match(killRegex);

      if (killMatch) {
        const killer = killMatch[1]; // e.g., s1mple<30><STEAM_1:1:36968273><TERRORIST>
        const victim = killMatch[2]; // player name
        const weapon = killMatch[3]; // e.g., glock

        // Ignore non-player victims (like func_breakable or props)
        if (!victim.startsWith("func_") && !victim.startsWith("prop_")) {
          const kill: Kill = {
            round: roundCount,
            time,
            killer,
            victim,
            weapon,
          };
          kills.push(kill);

          totalKills[killer] = (totalKills[killer] || 0) + 1;
          deaths[victim] = (deaths[victim] || 0) + 1;
          currentRoundKills++; //øger mængden af kills for den runde
        }
      }
    }
  }

  // After  the totalKills object
  const groupedKills: Record<"TERRORIST" | "CT", Record<string, number>> = {
    TERRORIST: {},
    CT: {},
  };

  for (const rawPlayerName in totalKills) {
    const { player, team } = extractPlayerAndTeam(rawPlayerName);
    if (team) {
      groupedKills[team][player] =
        (groupedKills[team][player] || 0) + totalKills[rawPlayerName];
    }
  }

  const averageRoundLength =
    roundCount > 0 ? +(totalRoundTime / roundCount).toFixed(2) : 0; // average længde i sekunder, rundet op

  return {
    averageRoundLength,
    totalKills,
    roundsWon,
    mostKillsInRound,
    deaths,
    bombPlants,
    bombDefuses,
    kills,
    groupedKills,
  };
}
