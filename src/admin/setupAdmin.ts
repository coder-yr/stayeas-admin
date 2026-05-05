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
    ,
    properties: {
      name: 'Name',
      location: 'Location',
      price: 'Price',
      taxRate: 'Tax Rate',
      category: 'Category',
      status: 'Status',
      description: 'Description',
      imagesFile: 'Images File',
      rating: 'Rating',
      reviewCount: 'Review Count',
      deposit: 'Deposit',
      rules: 'Rules',
      mealsIncluded: 'Meals Included',
      amenities: 'Amenities',
      fullAmenities: 'Full Amenities',
      nearby: 'Nearby',
      tiers: 'Tiers'
    },
    actions: {
      approve: 'Approve',
      approveOwner: 'Approve Owner Access'
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
        properties: { key: 'images', file: 'imagesFile' },
        multiple: true
      });

      return {
        resource: { model: getModelByName("Hotel"), client: prisma },
        options: {
          navigation: "Approvals",
          sort: { sortBy: 'createdAt', direction: 'desc' },
          listProperties: ['name', 'location', 'price', 'taxRate', 'category', 'status'],
          editProperties: [
            'name', 'location', 'price', 'taxRate', 'category', 'status',
            'description', 'imagesFile', 'rating', 'reviewCount', 
            'deposit', 'rules', 'mealsIncluded', 'amenities', 
            'fullAmenities', 'nearby', 'tiers'
          ],
          showProperties: [
            'id', 'name', 'location', 'price', 'taxRate', 'category', 'status',
            'description', 'images', 'rating', 'reviewCount', 
            'deposit', 'rules', 'mealsIncluded', 'amenities', 
            'fullAmenities', 'nearby', 'tiers', 'createdAt', 'updatedAt'
          ],
          properties: {
             status: {
              availableValues: [
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' }
              ]
            },
            category: {
              availableValues: [
                { value: 'Hotel', label: 'Hotel' },
                { value: 'PG', label: 'PG / Student Housing' },
                { value: 'Resort', label: 'Resort' },
                { value: 'Villa', label: 'Villa' },
                { value: 'Apartment', label: 'Apartment' },
                { value: 'Tropical', label: 'Tropical' },
                { value: 'Mountain', label: 'Mountain' }
              ]
            },
            taxRate: {
              type: 'number',
              helpText: 'Percentage tax rate (e.g. 12.00)',
            },
            description: { type: 'textarea' },
            rules: { type: 'textarea' },
            images: { isVisible: { list: false, edit: false, show: true, filter: false } },
            imagesFile: { isVisible: { list: false, edit: true, show: false, filter: false } },
            
            // Structured Inputs instead of JSON
            amenities: {
              type: 'mixed',
              label: 'Key Amenities (JSON)'
            },
            tiers: {
              // Use mixed JSON editor instead of array drag/drop to avoid runtime errors
              // when stored value is not an array (coerce at API/DB level instead).
              type: 'mixed',
              label: 'Room/Suite Tiers',
              props: {
                name: { type: 'string', label: 'Tier Name (e.g. Deluxe Suite)' },
                price: { type: 'string', label: 'Price (e.g. ₹5,000)' },
                availability: { type: 'string', label: 'Availability (e.g. AVAILABLE, 2 LEFT)' }
              }
            },
            nearby: {
              // Use mixed JSON editor for neighborhood metadata
              type: 'mixed',
              label: 'Neighborhood Spots',
              props: {
                name: { type: 'string', label: 'Spot Name' },
                distance: { type: 'string', label: 'Distance (e.g. 5 min walk)' },
                image: { type: 'string', label: 'Image URL' }
              }
            },
            fullAmenities: {
              // Treat fullAmenities as mixed JSON to accept arrays or objects safely
              type: 'mixed',
              label: 'Full Feature List'
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
