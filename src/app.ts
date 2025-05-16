import express from 'express';
import cors from 'cors';
import statsRoutes from './routes/stats';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/api/stats', statsRoutes); // tilføjer alle statistik-relaterede API-routes under stien /api/stats

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
