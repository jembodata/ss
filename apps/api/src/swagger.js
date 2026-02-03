export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SSRururu API",
    version: "1.0.0",
    description: "HTTP API for profiles, jobs, runs, schedules, notifications, and artifacts."
  },
  servers: [
    { url: "/api/v1", description: "v1" }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK"
          }
        }
      }
    },
    "/metrics/summary": {
      get: {
        summary: "Queue and run metrics summary",
        responses: { "200": { description: "OK" } }
      }
    },
    "/profiles": {
      get: {
        summary: "List profiles",
        responses: { "200": { description: "OK" } }
      },
      post: {
        summary: "Create profile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProfileCreate" }
            }
          }
        },
        responses: { "200": { description: "OK" } }
      }
    },
    "/profiles/{profileId}": {
      put: {
        summary: "Update profile",
        parameters: [
          { name: "profileId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProfileCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      },
      delete: {
        summary: "Delete profile",
        parameters: [
          { name: "profileId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/notifications": {
      get: { summary: "List notifications", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Create notification",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NotificationCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      }
    },
    "/notifications/{notificationId}": {
      put: {
        summary: "Update notification",
        parameters: [
          { name: "notificationId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NotificationCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      },
      delete: {
        summary: "Delete notification",
        parameters: [
          { name: "notificationId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/notifications/{notificationId}/test": {
      post: {
        summary: "Test notification by ID",
        parameters: [
          { name: "notificationId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/notifications/test-draft": {
      post: {
        summary: "Test notification draft",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/NotificationCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      }
    },
    "/jobs": {
      get: { summary: "List jobs", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Create job",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/JobCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      }
    },
    "/jobs/running": {
      get: { summary: "List running job IDs", responses: { "200": { description: "OK" } } }
    },
    "/jobs/{jobId}": {
      put: {
        summary: "Update job",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/JobCreate" } } }
        },
        responses: { "200": { description: "OK" } }
      },
      delete: {
        summary: "Delete job",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/jobs/{jobId}/run-now": {
      post: {
        summary: "Run job immediately",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/runs": {
      get: {
        summary: "List runs",
        parameters: [
          { name: "jobId", in: "query", required: false, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/runs/{runId}": {
      get: {
        summary: "Get run",
        parameters: [
          { name: "runId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      },
      delete: {
        summary: "Delete run",
        parameters: [
          { name: "runId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/jobs/{jobId}/schedules": {
      post: {
        summary: "Create schedules",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ScheduleCreate" } }
          }
        },
        responses: { "200": { description: "OK" } }
      },
      delete: {
        summary: "Delete schedules",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" } }
      }
    },
    "/jobs/{jobId}/schedules/status": {
      patch: {
        summary: "Toggle schedule status",
        parameters: [
          { name: "jobId", in: "path", required: true, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ScheduleToggle" } } }
        },
        responses: { "200": { description: "OK" } }
      }
    },
    "/schedules": {
      get: { summary: "List schedules", responses: { "200": { description: "OK" } } }
    },
    "/schedules/today": {
      get: { summary: "List schedules today", responses: { "200": { description: "OK" } } }
    },
    "/schedules/running": {
      get: { summary: "List running schedules", responses: { "200": { description: "OK" } } }
    }
  },
  components: {
    schemas: {
      ProfileCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          config: { type: "object" }
        },
        required: ["name", "config"]
      },
      JobCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          profileId: { type: "string" },
          config: { type: "object" }
        },
        required: ["name", "profileId", "config"]
      },
      NotificationCreate: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", example: "http" },
          endpoint: { type: "string" },
          body: { type: "string" },
          headers: { type: "string" },
          fileField: { type: "string", example: "file" }
        },
        required: ["name", "type", "endpoint", "body"]
      },
      ScheduleCreate: {
        type: "object",
        properties: {
          crons: { type: "array", items: { type: "string" } },
          timezone: { type: "string" },
          mode: { type: "string", enum: ["daily", "limited"] },
          remainingRuns: { type: "integer", nullable: true }
        },
        required: ["crons", "timezone"]
      },
      ScheduleToggle: {
        type: "object",
        properties: {
          enabled: { type: "boolean" }
        },
        required: ["enabled"]
      }
    }
  }
};
