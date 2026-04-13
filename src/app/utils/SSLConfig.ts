import SSLCommerzPayment from 'sslcommerz-lts';

const store_id: string | undefined = process.env.STORE_ID;
const store_passwd: string | undefined = process.env.STORE_PASSWD;
const is_live: boolean = process.env.IS_LIVE === 'true';

const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

export default sslcz;
