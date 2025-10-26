import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import cookieParser from 'cookie-parser';
import { errorMiddleware } from './error-handler/error-middleware';
import swaggerUi from 'swagger-ui-express';


const swaggerDocument = require('./swagger-output.json');


import authRoutes from './routes/auth.routes';
// import uploadRoutes from './routes/upload.routes';
// import userRoutes from './routes/user.routes';
// import subscriptionRoutes from './routes/subscription.routes';
import mongoose from 'mongoose';


config();

const app = express();
const port = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI!).then(
    ()=> console.log("DB is active")
).catch((err)=> {
    console.log(err)
})

app.use(
    cors({
        origin: [
            'http://localhost:3000',
        ],
        allowedHeaders: ['Authorization', 'Content-Type'],
        credentials: true,
    })
)

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send({message: 'API Service is running well'});
});

app.use('/api', authRoutes);
// app.use('/upload', uploadRoutes);
// app.use('/user', userRoutes)
// app.use('/subscription', subscriptionRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json(swaggerDocument);
});

app.use(errorMiddleware)

const server = app.listen(port, () => {
    console.log(`API Service is running on port http://localhost:${port}/api`);
});

server.on('error', console.error);