
import { createHmac } from "crypto"

export const generateHmac = (value: string) => {
    const secret = process.env.HMAC_SECRET ?? '';

    return createHmac('sha256', secret)
        .update(value)
        .digest('hex');
}
