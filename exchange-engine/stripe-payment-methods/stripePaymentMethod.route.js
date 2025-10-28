import express from 'express';
import {
  checkStripePaymentMethod,
  createCheckoutSession,
  deleteCustomPaymentMethod,
  getCustomerPaymentMethodList,
} from './stripePaymentMethods.controller';

const stripePaymentMethodsRouter = express.Router();

stripePaymentMethodsRouter.post(
  '/create-checkout-session',
  checkStripePaymentMethod,
  createCheckoutSession,
);

stripePaymentMethodsRouter.get(
  '/customer/:customerId/list',
  checkStripePaymentMethod,
  getCustomerPaymentMethodList,
);

stripePaymentMethodsRouter.delete(
  '/delete/:methodId',
  checkStripePaymentMethod,
  deleteCustomPaymentMethod,
);

export default stripePaymentMethodsRouter;
