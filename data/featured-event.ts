export type EventSession = {
  name: string;
  time: string;
  price: string;
};

export type FeaturedEvent = {
  id: string;
  title: string;
  partner: string;
  dateLabel: string;
  /** ISO datetime of when the event ends (America/Denver). Used to auto-hide. */
  endsAt: string;
  location: string;
  blurb: string;
  sessions: EventSession[];
  signupUrl: string;
  /** Short copy for the homepage announcement bar. */
  bannerText: string;
};

export const featuredEvent: FeaturedEvent = {
  id: "mahjong-in-bloom",
  title: "Mahjong in Bloom",
  partner: "Tee Lee Floral",
  dateLabel: "July 28, 2026",
  endsAt: "2026-07-28T20:00:00-06:00",
  location: "Olde Town Arvada",
  blurb:
    "An evening of tiles and blooms at Tee Lee Floral. Learn the game from scratch or come play with a little guidance — either way, you'll leave with new friends and a fresh appreciation for the click of the tiles.",
  sessions: [
    {
      name: "Introduction to Mahjong",
      time: "4:45 – 8:00 PM",
      price: "$60",
    },
    {
      name: "Guided Play",
      time: "6:00 – 8:00 PM",
      price: "$30",
    },
  ],
  signupUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSdE6-YtYI8qUtV6LgRaeB062e2V7Wd7nUg0Tses3KVmk9Uarg/viewform",
  bannerText: "Mahjong in Bloom — July 28 at Tee Lee Floral, Olde Town Arvada",
};

/** True once the event has ended, so it can be hidden automatically. */
export function isFeaturedEventOver(now: Date = new Date()): boolean {
  return now.getTime() > new Date(featuredEvent.endsAt).getTime();
}
