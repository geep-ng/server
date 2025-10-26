const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "api services",
    description: "Automatically generated Swagger docs",
    version: "1.0.0",
  },
  host: "localhost:4000",
  schemes: ["http"],
};

const outputFile = "./swagger-output.json";
const endpointsFiles = ["./routes/auth.routes.ts", "./routes/transaction.routes.ts"];

swaggerAutogen(outputFile, endpointsFiles, doc);