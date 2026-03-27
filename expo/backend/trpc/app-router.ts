import { createTRPCRouter } from "./create-context";
import { farmRouter } from "./routes/farm";

export const appRouter = createTRPCRouter({
  farm: farmRouter,
});

export type AppRouter = typeof appRouter;
