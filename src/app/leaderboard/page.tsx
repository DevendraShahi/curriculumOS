export default function LeaderboardPage() {
  const avatarColors = ["bg-blue-100 text-blue-700", "bg-rose-100 text-rose-700", "bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700", "bg-teal-100 text-teal-700"];
  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  const topUsers = [
    { name: "Sarah Chen", points: 14500, level: 42, streak: 120 },
    { name: "Alex Rivers", points: 13200, level: 38, streak: 45 },
    { name: "Diego Silva", points: 12850, level: 36, streak: 89 },
  ];

  const restUsers = [
    { rank: 4, name: "Priya Patel", points: 11400, level: 32 },
    { rank: 5, name: "Liam O'Connor", points: 10900, level: 30 },
    { rank: 6, name: "Fatima Khan", points: 9850, level: 28 },
    { rank: 7, name: "Marco Rossi", points: 8400, level: 24 },
    { rank: 8, name: "Tina Yu", points: 7200, level: 21 },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col rounded-none">
      
      {/* Top Navbar */}
      <header className="flex items-center justify-between h-auto sm:h-12 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 py-3 sm:py-0 shrink-0 rounded-none flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="font-mono text-[10px] text-[var(--foreground)] uppercase tracking-widest font-semibold">Leaderboard</h1>
          <div className="h-4 w-[1px] bg-[var(--border)] hidden sm:block" />
          <div className="flex gap-2 sm:gap-4">
            <button className="font-mono text-[9px] uppercase tracking-widest text-[var(--accent)] hover:opacity-80 cursor-pointer">Global</button>
            <button className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer hidden sm:inline">Friends</button>
            <button className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer hidden sm:inline">This Week</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Season Ends In: <span className="text-[var(--foreground)]">4D 12H</span></span>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full p-4 sm:p-6 lg:p-8 gap-6 lg:gap-8">
        
        {/* Main Leaderboard List */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Top 3 Podium (Brutalist style) */}
          <div className="grid grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-none">
            {/* Rank 2 */}
            <div className="bg-[var(--surface)] p-6 flex flex-col items-center text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Rank 2</div>
              <div className={`w-16 h-16 rounded-none flex items-center justify-center text-xl font-bold mb-3 ${avatarColors[1]}`}>{initials(topUsers[1].name)}</div>
              <h3 className="font-medium text-[var(--foreground)] tracking-tight">{topUsers[1].name}</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] mt-2">{topUsers[1].points} XP</p>
            </div>
            
            {/* Rank 1 */}
            <div className="bg-white p-6 flex flex-col items-center text-center relative border-b-4 border-b-[var(--accent)]">
              <div className="absolute top-0 left-0 w-full h-1 bg-[var(--accent)]" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] mb-4 font-bold">Rank 1</div>
              <div className={`w-20 h-20 rounded-none flex items-center justify-center text-2xl font-bold mb-3 border-2 border-[var(--accent)] ${avatarColors[0]}`}>{initials(topUsers[0].name)}</div>
              <h3 className="text-lg font-medium text-[var(--foreground)] tracking-tight">{topUsers[0].name}</h3>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)] mt-2 font-bold">{topUsers[0].points} XP</p>
            </div>

            {/* Rank 3 */}
            <div className="bg-[var(--surface)] p-6 flex flex-col items-center text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-4">Rank 3</div>
              <div className={`w-16 h-16 rounded-none flex items-center justify-center text-xl font-bold mb-3 ${avatarColors[2]}`}>{initials(topUsers[2].name)}</div>
              <h3 className="font-medium text-[var(--foreground)] tracking-tight">{topUsers[2].name}</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] mt-2">{topUsers[2].points} XP</p>
            </div>
          </div>

          {/* List Remaining */}
          <div className="border border-[var(--border)] bg-[var(--border)] flex flex-col gap-px rounded-none">
            {restUsers.map((user) => (
              <div key={user.rank} className="flex items-center gap-4 p-4 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors rounded-none group">
                <div className="w-8 text-center font-mono text-xs text-[var(--muted-foreground)]">{user.rank}</div>
                <div className={`w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-bold ${avatarColors[(user.rank - 1) % avatarColors.length]}`}>{initials(user.name)}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--foreground)] tracking-tight group-hover:text-[var(--accent)] transition-colors">{user.name}</h4>
                  <div className="flex gap-3 mt-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Level {user.level}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--foreground)]">{user.points} XP</span>
                </div>
              </div>
            ))}
            
            {/* Current User Fixed Bar */}
            <div className="flex items-center gap-4 p-4 bg-white border-t-2 border-[var(--accent)] mt-8 sticky bottom-0 rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <div className="w-8 text-center font-mono text-xs text-[var(--foreground)] font-bold">142</div>
              <div className={`w-8 h-8 rounded-none flex items-center justify-center text-[10px] font-bold bg-gray-200 text-black`}>DT</div>
              <div className="flex-1">
                <h4 className="font-medium text-[var(--foreground)] tracking-tight">Devendra Shahi Thakuri (You)</h4>
                <div className="flex gap-3 mt-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">Level 12</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] font-bold">2,140 XP</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          
          <div className="border border-[var(--border)] bg-[var(--surface)] p-6 rounded-none">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-6">Your Stats</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">Level 12</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">2140 / 3000 XP</span>
                </div>
                <div className="w-full h-1.5 bg-[var(--border)] rounded-none overflow-hidden">
                  <div className="h-full bg-[var(--accent)] w-[71%] rounded-none" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] rounded-none">
                <div className="bg-[var(--background)] p-4 flex flex-col gap-1 text-center">
                  <span className="font-mono text-xl text-[var(--foreground)]">4</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF7A2F]">Day Streak</span>
                </div>
                <div className="bg-[var(--background)] p-4 flex flex-col gap-1 text-center">
                  <span className="font-mono text-xl text-[var(--foreground)]">14</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#21B8A8]">Lessons</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] p-6 rounded-none">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)] mb-6">How to earn XP</h2>
            <ul className="space-y-4">
              <li className="flex justify-between items-center text-sm text-[var(--foreground)]">
                <span>Complete a lesson</span>
                <span className="font-mono text-[10px] text-[var(--accent)]">+100</span>
              </li>
              <li className="flex justify-between items-center text-sm text-[var(--foreground)]">
                <span>Pass a quiz perfectly</span>
                <span className="font-mono text-[10px] text-[var(--accent)]">+50</span>
              </li>
              <li className="flex justify-between items-center text-sm text-[var(--foreground)]">
                <span>Maintain 7-day streak</span>
                <span className="font-mono text-[10px] text-[var(--accent)]">+500</span>
              </li>
              <li className="flex justify-between items-center text-sm text-[var(--foreground)]">
                <span>Answer in community</span>
                <span className="font-mono text-[10px] text-[var(--accent)]">+20</span>
              </li>
            </ul>
          </div>
          
        </aside>
      </main>
    </div>
  );
}
