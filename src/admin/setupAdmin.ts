import AdminJS, { ComponentLoader } from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource, getModelByName } from "@adminjs/prisma";
import session from "express-session";
import type { Express } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { verifyPassword } from "../utils/password.js";
import uploadFeature from '@adminjs/upload';
import { LocalProviderSafe } from './LocalProviderSafe.js';
import * as url from 'url';
import * as path from 'path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter({ Database, Resource });

const componentLoader = new ComponentLoader();

const parsePrefs = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const adminLocale = {
  language: "en",
  availableLanguages: ["en"],
  translations: {
    labels: {
      User: "User",
      Users: "Users",
      Hotel: "Hotel",
      Approvals: "Approvals",
      Booking: "Booking",
      Transactions: "Transactions",
      ChatLog: "Chat Log",
      AI: "AI",
      Flight: "Flight",
      Inventory: "Inventory"
    }
  }
};

const buildResources = () => [
    {
      resource: { model: getModelByName("User"), client: prisma },
      options: {
        navigation: "Users",
        sort: { sortBy: "createdAt", direction: "desc" },
        listProperties: ["email", "name", "role", "createdAt"],
        actions: {
          approveOwner: {
            actionType: 'record' as const,
            icon: 'CheckCircle',
            label: 'Approve Owner Access',
            component: false,
            isVisible: ({ record }: { record?: any }) => {
              if (!record) return false;
              const role = record.params?.role;
              const prefs = parsePrefs(record.params?.preferences);
              const status = prefs?.ownerApplication?.status;
              return role === 'user' && status === 'pending';
            },
            handler: async (_request: any, _response: any, context: any) => {
              const { record } = context;
              const prefs = parsePrefs(record.params?.preferences);
              const nextPrefs = {
                ...prefs,
                ownerApplication: {
                  ...(prefs.ownerApplication ?? {}),
                  status: 'approved',
                  approvedAt: new Date().toISOString()
                }
              };

              await record.update({ params: { role: 'owner', preferences: nextPrefs } });
              return {
                record: record.toJSON(context),
                notice: { message: 'Owner access approved', type: 'success' }
              };
            }
          }
        }
      }
    },
    (() => {
      const feature = uploadFeature({
        componentLoader,
        provider: new LocalProviderSafe({
          bucket: 'public/uploads',
          opts: { baseUrl: '/uploads' }
        }),
        properties: { key: 'images', file: 'uploadFiles' },
        multiple: true
      });

      return {
        resource: { model: getModelByName("Hotel"), client: prisma },
        options: {
          navigation: "Approvals",
          sort: { sortBy: 'createdAt', direction: 'desc' },
          defaultFilter: { status: 'pending' },
          properties: {
             status: {
              availableValues: [
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' }
              ]
            }
          },
          actions: {
            approve: {
              actionType: 'record' as const,
              icon: 'CheckCircle',
              label: 'Approve Hotel',
              component: false,
              handler: async (_request: any, _response: any, context: any) => {
                const { record } = context;
                await record.update({ params: { status: 'approved' } });
                return {
                  record: record.toJSON(context),
                  notice: { message: 'Hotel approved successfully', type: 'success' }
                };
              }
            }
          },
          features: [feature]
        }
      };
    })(),
  {
    resource: { model: getModelByName("Booking"), client: prisma },
    options: { navigation: "Transactions" }
  },
  {
    resource: { model: getModelByName("ChatLog"), client: prisma },
    options: { navigation: "AI" }
  },
  {
    resource: { model: getModelByName("Flight"), client: prisma },
    options: { navigation: "Inventory" }
  }
];

export const mountAdminPanel = async (app: Express) => {
  const resources = buildResources();

  const admin = new AdminJS({
    rootPath: "/admin",
    componentLoader,
    locale: adminLocale,
    branding: {
      companyName: "StayEase Admin",
      logo: false,
      withMadeWithLove: false
    },
    resources
  });

  if (env.NODE_ENV === "production") {
    await admin.initialize();
  } else {
    void admin.watch();
  }

  const router = AdminJSExpress.buildRouter(admin);

  app.use(admin.options.rootPath, router);
};
