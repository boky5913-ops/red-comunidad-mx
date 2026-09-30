import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { z } from "zod";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  community: router({
    list: publicProcedure.query(async () => {
      const posts = await db.listCommunityPosts();
      return posts.map((post) => ({
        ...post,
        imageUrls: post.imageUrls ? JSON.parse(post.imageUrls) as string[] : [],
      }));
    }),
    create: protectedProcedure
      .input(z.object({
        category: z.enum(["empleo", "trueque"]),
        mode: z.enum(["trueque", "donacion"]).optional(),
        title: z.string().min(1).max(255),
        description: z.string().min(1).max(2000),
        location: z.string().min(1).max(255),
        contactName: z.string().min(1).max(160),
        whatsapp: z.string().min(10).max(32),
        imageUrls: z.array(z.string().url()).max(5).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const post = await db.createCommunityPost({
          ...input,
          ownerId: ctx.user.id,
          imageUrls: JSON.stringify(input.imageUrls),
        });
        return { ...post, imageUrls: input.imageUrls };
      }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const posts = await db.listUserCommunityPosts(ctx.user.id);
      return posts.map((post) => ({ ...post, imageUrls: post.imageUrls ? JSON.parse(post.imageUrls) as string[] : [] }));
    }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().min(1).max(2000),
        location: z.string().min(1).max(255),
        contactName: z.string().min(1).max(160),
        whatsapp: z.string().min(10).max(32),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const post = await db.updateUserCommunityPost(ctx.user.id, id, data);
        return { ...post, imageUrls: post.imageUrls ? JSON.parse(post.imageUrls) as string[] : [] };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => db.deleteUserCommunityPost(ctx.user.id, input.id)),
  }),

  media: router({
    uploadImage: publicProcedure
      .input(z.object({
        base64: z.string().min(1).max(4_000_000),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        extension: z.enum(["jpg", "png", "webp"]),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.byteLength > 3_000_000) throw new Error("Image exceeds the 3 MB limit");
        const uploaded = await storagePut(`community-images/item.${input.extension}`, buffer, input.contentType);
        return uploaded.url;
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
