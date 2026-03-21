export type Event = {
  id: string;
  title: string;
  type: "private-party" | "lesson" | "charity";
  typeLabel: string;
  description: string;
  vibe: { emoji: string; label: string };
};

export const events: Event[] = [
  {
    id: "girls-night",
    title: "Girls Night In",
    type: "private-party",
    typeLabel: "Private Parties",
    description:
      "I'll bring the tiles, teach the game, and make sure everyone has the best time.",
    vibe: { emoji: "🥂", label: "Social & Fun" },
  },
  {
    id: "learn-to-play",
    title: "Learn to Play",
    type: "lesson",
    typeLabel: "Lessons",
    description:
      "Group or private lessons for players at any level. You'll be calling \"mahjong!\" in no time.",
    vibe: { emoji: "🎓", label: "All Levels" },
  },
  {
    id: "play-for-cause",
    title: "Play for a Cause",
    type: "charity",
    typeLabel: "Charity Events",
    description:
      "Tournaments that raise money for causes you care about. Competitive, social, and meaningful.",
    vibe: { emoji: "❤️", label: "Community" },
  },
];
