import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { adminBackendResponse } from "../../utils/admin-backend";
import { requireSameOrigin } from "../../utils/backend";
import {
  maxRecipePhotoBytes,
  recipePhotoType,
} from "../../../shared/recipe/photo";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const access = await adminBackendResponse(event, "/api/admin/recipes/access");
  if (!access.ok) return sendWebResponse(event, access);
  const config = useRuntimeConfig(event).recipePhotos;
  if (
    !config.accountId ||
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucket ||
    !config.publicBase
  )
    throw createError({
      statusCode: 503,
      message: "Хранилище фотографий ещё не подключено.",
    });
  if (
    !/^[a-f0-9]{32}$/i.test(config.accountId) ||
    !/^https:\/\//.test(config.publicBase)
  )
    throw createError({
      statusCode: 503,
      message: "Проверьте настройки хранилища фотографий.",
    });
  const length = Number(getHeader(event, "content-length"));
  if (!length || length > maxRecipePhotoBytes + 65536)
    throw createError({
      statusCode: 413,
      message: "Фото должно быть не больше 4 МБ.",
    });
  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "photo" && part.filename);
  if (!file?.data || file.data.length > maxRecipePhotoBytes)
    throw createError({ statusCode: 400, message: "Выберите фото до 4 МБ." });
  const type = recipePhotoType(file.data);
  if (!type)
    throw createError({
      statusCode: 400,
      message: "Поддерживаются JPEG, PNG и WebP.",
    });
  const contentType = type === "jpg" ? "image/jpeg" : `image/${type}`;
  const key = `recipes/${crypto.randomUUID()}.${type}`;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: file.data,
        ContentType: contentType,
        CacheControl: "public,max-age=31536000,immutable",
      }),
      { abortSignal: AbortSignal.timeout(65000) },
    );
  } catch {
    throw createError({
      statusCode: 502,
      message: "Не удалось загрузить фото. Проверьте настройки хранилища.",
    });
  } finally {
    client.destroy();
  }
  return { url: `${config.publicBase.replace(/\/+$/, "")}/${key}` };
});
