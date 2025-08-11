import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Helper to parse genres
const splitGenres = (genres?: string) =>
  genres ? genres.split(",").map((g) => g.trim()) : [];

// Add a new movie
app.post("/movies", async (req, res) => {
  const { title, year, genres } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const genresStr = Array.isArray(genres) ? genres.join(", ") : genres || null;

  try {
    const movie = await prisma.movie.create({
      data: { title, year, genres: genresStr },
    });
    res.status(201).json(movie);
  } catch (err) {
    res.status(400).json({ error: "could not add movie (maybe duplicate)" });
  }
});

// Get movie details
app.get("/movies/:id", async (req, res) => {
  const movie = await prisma.movie.findUnique({
    where: { id: Number(req.params.id) },
    include: { reviews: true },
  });
  if (!movie) return res.status(404).json({ error: "movie not found" });

  const avg =
    movie.reviews.length > 0
      ? Number(
          (
            movie.reviews.reduce((sum, r) => sum + r.rating, 0) /
            movie.reviews.length
          ).toFixed(2)
        )
      : null;

  res.json({
    ...movie,
    genres: splitGenres(movie.genres || undefined),
    average_rating: avg,
  });
});

// Submit a review
app.post("/movies/:id/reviews", async (req, res) => {
  const movieId = Number(req.params.id);
  const { rating, comment } = req.body;
  if (rating == null) return res.status(400).json({ error: "rating required" });

  if (rating < 1 || rating > 5)
    return res.status(400).json({ error: "rating must be 1-5" });

  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) return res.status(404).json({ error: "movie not found" });

  const review = await prisma.review.create({
    data: { movieId, rating, comment },
  });
  res.status(201).json(review);
});

// Get average rating
app.get("/movies/:id/rating", async (req, res) => {
  const movieId = Number(req.params.id);
  const reviews = await prisma.review.findMany({ where: { movieId } });
  if (!reviews.length)
    return res.json({ movieId, average: null, count: 0 });

  const avg = Number(
    (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
  );
  res.json({ movieId, average: avg, count: reviews.length });
});

// Top-rated movies
app.get("/movies/top", async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const minReviews = Number(req.query.min_reviews) || 0;

  const movies = await prisma.movie.findMany({
    include: { reviews: true },
  });

  const ranked = movies
    .map((m) => {
      const count = m.reviews.length;
      const avg =
        count > 0
          ? m.reviews.reduce((sum, r) => sum + r.rating, 0) / count
          : null;
      return { ...m, average_rating: avg, reviews_count: count };
    })
    .filter((m) => m.average_rating !== null && m.reviews_count >= minReviews)
    .sort((a, b) => (b.average_rating! - a.average_rating!) || (b.reviews_count - a.reviews_count))
    .slice(0, limit);

  res.json(ranked);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
