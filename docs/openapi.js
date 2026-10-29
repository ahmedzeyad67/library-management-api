const idParameter = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
});

const paginationParameters = (sortFields) => [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100 },
  },
  { name: "sort", in: "query", schema: { type: "string", enum: sortFields } },
  {
    name: "order",
    in: "query",
    schema: { type: "string", enum: ["asc", "desc"] },
  },
];

const jsonBody = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});
const protectedOperation = { security: [{ bearerAuth: [] }] };
const successResponse = (schema, description = "Successful response") => ({
  description,
  content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  },
});
const commonResponses = () => ({
  400: { $ref: "#/components/responses/ValidationError" },
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
  404: { $ref: "#/components/responses/NotFound" },
  409: { $ref: "#/components/responses/Conflict" },
});

const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Library Management API",
    version: "1.0.0",
    description:
      "RESTful API for managing books, users, loans, and reservations.",
  },
  servers: [{ url: "/api", description: "Current server" }],
  tags: [
    { name: "Authentication" },
    { name: "Users" },
    { name: "Books" },
    { name: "Loans" },
    { name: "Reservations" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      SuccessBase: {
        type: "object",
        required: ["status", "data"],
        properties: {
          status: { type: "string", example: "success" },
          data: {},
        },
      },
      AuthSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { $ref: "#/components/schemas/AuthTokens" } } },
      NullSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { nullable: true, example: null } } },
      UserSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { $ref: "#/components/schemas/User" } } },
      UserUpdateSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } },
      BookSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { $ref: "#/components/schemas/Book" } } },
      BookListSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { type: "array", items: { $ref: "#/components/schemas/Book" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      UserListSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { type: "array", items: { $ref: "#/components/schemas/User" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      LoanSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { $ref: "#/components/schemas/Loan" } } },
      LoanListSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { type: "array", items: { $ref: "#/components/schemas/Loan" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      ReservationSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { $ref: "#/components/schemas/Reservation" } } },
      ReservationListSuccess: { allOf: [{ $ref: "#/components/schemas/SuccessBase" }], properties: { data: { type: "array", items: { $ref: "#/components/schemas/Reservation" } }, pagination: { $ref: "#/components/schemas/Pagination" } } },
      Error: {
        type: "object",
        required: ["status", "message"],
        properties: {
          status: { type: "string", example: "error" },
          message: { type: "string" },
        },
      },
      AuthTokens: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          role: { type: "string", enum: ["user", "admin"] },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Book: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          author: { type: "string" },
          isbn: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          publishedYear: { type: "integer", minimum: 1000, description: "The current year or an earlier year." },
          totalCopies: { type: "integer" },
          availableCopies: { type: "integer" },
          isActive: { type: "boolean" },
          coverImage: {
            type: "object",
            properties: { url: { type: "string", format: "uri" } },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      BookInput: {
        type: "object",
        required: [
          "title",
          "author",
          "isbn",
          "category",
          "description",
          "publishedYear",
          "totalCopies",
        ],
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          isbn: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          publishedYear: { type: "integer" },
          totalCopies: { type: "integer", minimum: 1 },
          isActive: { type: "boolean", description: "Optional on create; controlled by activation endpoints afterward." },
          coverImage: { type: "string", format: "binary" },
        },
        additionalProperties: false,
      },
      BookUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          title: { type: "string" }, author: { type: "string" }, isbn: { type: "string" }, category: { type: "string" },
          description: { type: "string" }, publishedYear: { type: "integer" }, totalCopies: { type: "integer", minimum: 1 },
          coverImage: { type: "string", format: "binary" },
        },
        additionalProperties: false,
      },
      UserUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
        },
        additionalProperties: false,
      },
      Loan: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          bookId: { type: "string" },
          user: { $ref: "#/components/schemas/UserReference" },
          book: { $ref: "#/components/schemas/BookReference" },
          borrowedAt: { type: "string", format: "date-time" },
          dueDate: { type: "string", format: "date-time" },
          returnedAt: { type: "string", format: "date-time", nullable: true },
          status: { type: "string", enum: ["borrowed", "overdue", "returned"] },
          fine: { type: "number", minimum: 0 },
        },
      },
      Reservation: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          bookId: { type: "string" },
          user: { $ref: "#/components/schemas/UserReference" },
          book: { $ref: "#/components/schemas/BookReference" },
          status: {
            type: "string",
            enum: ["pending", "approved", "fulfilled", "cancelled", "expired"],
          },
          reservedAt: { type: "string", format: "date-time" },
          pickupDeadline: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
      UserReference: {
        type: "object",
        properties: {
          _id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
        },
      },
      BookReference: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          author: { type: "string" },
          isbn: { type: "string" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description:
          "Authentication is required or the access token is invalid.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Authentication required" } } },
      },
      Forbidden: {
        description: "You do not have permission to perform this operation.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Forbidden" } } },
      },
      ValidationError: { description: "Request validation failed.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Validation failed" } } } },
      NotFound: { description: "The requested resource was not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Resource not found" } } } },
      Conflict: { description: "The request conflicts with the current resource state.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Resource already exists" } } } },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register",
        requestBody: jsonBody({
          type: "object",
          required: ["firstName", "lastName", "email", "phone", "password"],
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            password: { type: "string", format: "password", minLength: 8 },
          },
        }),
        responses: {
          201: successResponse("AuthSuccess", "User registered"),
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in",
        requestBody: jsonBody({
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
        }),
        responses: {
          200: successResponse("AuthSuccess", "Login successful"),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Log out",
        requestBody: jsonBody({
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        }),
        responses: {
          200: successResponse("NullSuccess"),
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh tokens",
        requestBody: jsonBody({
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        }),
        responses: {
          200: successResponse("AuthSuccess"),
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/change-password": {
      patch: {
        ...protectedOperation,
        tags: ["Authentication"],
        summary: "Change password",
        requestBody: jsonBody({
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", format: "password" },
            newPassword: { type: "string", format: "password", minLength: 8 },
          },
        }),
        responses: { 200: successResponse("NullSuccess"), ...commonResponses() },
      },
    },
    "/auth/me": {
      get: {
        ...protectedOperation,
        tags: ["Authentication"],
        summary: "Get me",
        responses: { 200: successResponse("UserSuccess"), ...commonResponses() },
      },
    },
    "/users": {
      get: {
        ...protectedOperation,
        tags: ["Users"],
        summary: "List users (admin)",
        parameters: [
          ...paginationParameters([
            "firstName",
            "lastName",
            "email",
            "createdAt",
          ]),
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "role",
            in: "query",
            schema: { type: "string", enum: ["user", "admin"] },
          },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: successResponse("UserListSuccess"), ...commonResponses() },
      },
    },
    "/users/me": {
      patch: {
        ...protectedOperation,
        tags: ["Users"],
        summary: "Update profile",
        requestBody: jsonBody({ $ref: "#/components/schemas/UserUpdate" }),
        responses: { 200: successResponse("UserUpdateSuccess"), ...commonResponses() },
      },
    },
    "/users/{userId}/activate": {
      patch: {
        ...protectedOperation,
        tags: ["Users"],
        summary: "Activate a user (admin)",
        parameters: [idParameter("userId", "User ID")],
        responses: { 200: successResponse("UserSuccess"), ...commonResponses() },
      },
    },
    "/users/{userId}/deactivate": {
      patch: {
        ...protectedOperation,
        tags: ["Users"],
        summary: "Deactivate a user (admin)",
        parameters: [idParameter("userId", "User ID")],
        responses: { 200: successResponse("UserSuccess"), ...commonResponses() },
      },
    },
    "/books": {
      get: {
        tags: ["Books"],
        summary: "List active books",
        parameters: paginationParameters([
          "title",
          "author",
          "publishedYear",
          "createdAt",
        ]).concat([{ name: "search", in: "query", description: "Search by title or author", schema: { type: "string" } }]),
        responses: {
          200: successResponse("BookListSuccess"),
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
      post: {
        ...protectedOperation,
        tags: ["Books"],
        summary: "Create a book (admin)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/BookInput" },
            },
          },
        },
        responses: { 201: successResponse("BookSuccess"), ...commonResponses() },
      },
    },
    "/books/admin": {
      get: {
        ...protectedOperation,
        tags: ["Books"],
        summary: "List all books (admin)",
        parameters: [
          ...paginationParameters([
            "title",
            "author",
            "publishedYear",
            "createdAt",
          ]),
          { name: "search", in: "query", description: "Search by title or author", schema: { type: "string" } },
          { name: "isActive", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: successResponse("BookListSuccess"), ...commonResponses() },
      },
    },
    "/books/{bookId}": {
      get: {
        tags: ["Books"],
        summary: "Get a book by ID",
        parameters: [idParameter("bookId", "Book ID")],
        responses: {
          200: successResponse("BookSuccess"),
          400: { $ref: "#/components/responses/ValidationError" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        ...protectedOperation,
        tags: ["Books"],
        summary: "Update a book (admin)",
        parameters: [idParameter("bookId", "Book ID")],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { $ref: "#/components/schemas/BookUpdate" },
            },
          },
        },
        responses: { 200: successResponse("BookSuccess"), ...commonResponses() },
      },
    },
    "/books/{bookId}/activate": {
      patch: {
        ...protectedOperation,
        tags: ["Books"],
        summary: "Activate a book (admin)",
        parameters: [idParameter("bookId", "Book ID")],
        responses: { 200: successResponse("BookSuccess"), ...commonResponses() },
      },
    },
    "/books/{bookId}/deactivate": {
      patch: {
        ...protectedOperation,
        tags: ["Books"],
        summary: "Deactivate a book (admin)",
        parameters: [idParameter("bookId", "Book ID")],
        responses: { 200: successResponse("BookSuccess"), ...commonResponses() },
      },
    },
    "/loans": {
      get: {
        ...protectedOperation,
        tags: ["Loans"],
        summary: "List loans",
        parameters: [
          ...paginationParameters(["borrowedAt", "returnedAt"]),
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["borrowed", "overdue", "returned"],
            },
          },
          { name: "userSearch", in: "query", schema: { type: "string" } },
          { name: "bookSearch", in: "query", schema: { type: "string" } },
          {
            name: "borrowedAt",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "returnedAt",
            in: "query",
            schema: { type: "string", format: "date" },
          },
        ],
        responses: { 200: successResponse("LoanListSuccess"), ...commonResponses() },
      },
    },
    "/loans/{loanId}": {
      get: {
        ...protectedOperation,
        tags: ["Loans"],
        summary: "Get a loan by ID",
        parameters: [idParameter("loanId", "Loan ID")],
        responses: { 200: successResponse("LoanSuccess"), ...commonResponses() },
      },
    },
    "/loans/{loanId}/return": {
      patch: {
        ...protectedOperation,
        tags: ["Loans"],
        summary: "Return a loan (admin)",
        parameters: [idParameter("loanId", "Loan ID")],
        responses: { 200: successResponse("LoanSuccess"), ...commonResponses() },
      },
    },
    "/reservations": {
      get: {
        ...protectedOperation,
        tags: ["Reservations"],
        summary: "List reservations",
        parameters: [
          ...paginationParameters(["reservedAt", "pickupDeadline"]),
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "pending",
                "approved",
                "fulfilled",
                "cancelled",
                "expired",
              ],
            },
          },
        ],
        responses: { 200: successResponse("ReservationListSuccess"), ...commonResponses() },
      },
      post: {
        ...protectedOperation,
        tags: ["Reservations"],
        summary: "Create a reservation",
        requestBody: jsonBody({
          type: "object",
          required: ["bookId"],
          properties: {
            bookId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
          },
        }),
        responses: { 200: successResponse("ReservationSuccess"), ...commonResponses() },
      },
    },
    "/reservations/{reservationId}": {
      get: {
        ...protectedOperation,
        tags: ["Reservations"],
        summary: "Get a reservation by ID",
        parameters: [idParameter("reservationId", "Reservation ID")],
        responses: { 200: successResponse("ReservationSuccess"), ...commonResponses() },
      },
    },
    "/reservations/{reservationId}/cancel": {
      patch: {
        ...protectedOperation,
        tags: ["Reservations"],
        summary: "Cancel a reservation",
        parameters: [idParameter("reservationId", "Reservation ID")],
        responses: { 200: successResponse("ReservationSuccess"), ...commonResponses() },
      },
    },
    "/reservations/{reservationId}/fulfill": {
      patch: {
        ...protectedOperation,
        tags: ["Reservations"],
        summary: "Fulfill a reservation (admin)",
        parameters: [idParameter("reservationId", "Reservation ID")],
        responses: { 200: successResponse("ReservationSuccess"), ...commonResponses() },
      },
    },
  },
};

export default openapi;
