import axios from "axios";
import { config, socialMockMode } from "../config.js";

const base = (id) =>
  `https://graph.facebook.com/${config.meta.graphVersion}/${id}`;

/**
 * Publish a post to a Facebook Page feed.
 * Mock mode returns a synthetic id so scheduling works without live credentials.
 */
async function postToFacebook({ caption, imageUrl }) {
  if (socialMockMode) {
    return { ok: true, mock: true, id: `fb-mock-${Date.now()}` };
  }
  const token = config.meta.facebookPageAccessToken;
  const pageId = config.meta.facebookPageId;
  const endpoint = imageUrl
    ? `${base(pageId)}/photos`
    : `${base(pageId)}/feed`;
  const params = imageUrl
    ? { url: imageUrl, caption, access_token: token }
    : { message: caption, access_token: token };
  const { data } = await axios.post(endpoint, null, { params });
  return { ok: true, mock: false, id: data.id || data.post_id };
}

/**
 * Publish a post to Instagram (requires an image — Graph API two-step flow).
 */
async function postToInstagram({ caption, imageUrl }) {
  if (socialMockMode) {
    return { ok: true, mock: true, id: `ig-mock-${Date.now()}` };
  }
  if (!imageUrl) {
    return { ok: false, error: "Instagram posts require an image_url" };
  }
  const token = config.meta.facebookPageAccessToken;
  const igId = config.meta.instagramBusinessAccountId;

  // Step 1: create a media container.
  const { data: container } = await axios.post(`${base(igId)}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: token },
  });
  // Step 2: publish the container.
  const { data: published } = await axios.post(
    `${base(igId)}/media_publish`,
    null,
    { params: { creation_id: container.id, access_token: token } }
  );
  return { ok: true, mock: false, id: published.id };
}

export async function publishPost({ caption, imageUrl, platforms }) {
  const results = {};
  for (const platform of platforms) {
    try {
      if (platform === "facebook") {
        results.facebook = await postToFacebook({ caption, imageUrl });
      } else if (platform === "instagram") {
        results.instagram = await postToInstagram({ caption, imageUrl });
      }
    } catch (err) {
      const detail =
        err.response?.data?.error?.message || err.message || "post failed";
      results[platform] = { ok: false, error: detail };
    }
  }
  const ok = Object.values(results).some((r) => r.ok);
  return { ok, results };
}
