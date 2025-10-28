import express from 'express';

import commonDevRouter from './dev.route';
import authDevRouter from './auth.route';
import emailDevRouter from './email.route';
import utilityDevRouter from './utility.route';
import dev1Router from './v1/dev1.route';
import dev2Router from './v2/dev2.route';

const v1Router = express.Router();
v1Router.use(commonDevRouter);
v1Router.use(authDevRouter);
v1Router.use(emailDevRouter);
v1Router.use(utilityDevRouter);
v1Router.use(dev1Router);

const v2Router = express.Router();
v2Router.use(commonDevRouter);
v2Router.use(authDevRouter);
v2Router.use(emailDevRouter);
v2Router.use(utilityDevRouter);
v2Router.use(dev2Router);

export { v1Router, v2Router };
