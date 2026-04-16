export type Book = {
  id: string;
  title: string;
  authors: string;
  description: string;
  affiliateUrl: string;
  cover: string;
};

export const books: Book[] = [
  {
    id: "grandma-dotties-dots",
    title: "Grandma Dottie's Dots",
    authors: "Gabby & Mark Spatt",
    description:
      "A tender picture book about a grandmother, her granddaughter, and the tiles that click-clack like music. A celebration of love, family, and a game that spans generations.",
    affiliateUrl: "https://amzn.to/4vy1691",
    cover: "/books/grandma-dotties-dots.jpg",
  },
  {
    id: "bubbe-and-bams",
    title: "Bubbe and Bams",
    authors: "Gabby & Mark Spatt",
    description:
      "The Yiddish-flavored companion to Grandma Dottie's Dots. Same heart, same magical tiles, passed down from Bubbe to her granddaughter.",
    affiliateUrl: "https://amzn.to/3OJHbDC",
    cover: "/books/bubbe-and-bams.jpg",
  },
];
