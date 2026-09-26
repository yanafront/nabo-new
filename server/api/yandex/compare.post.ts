import { proxyBackend } from "../../utils/backend";
export default defineEventHandler(event => proxyBackend(event, "/api/yandex/compare", "POST"));
