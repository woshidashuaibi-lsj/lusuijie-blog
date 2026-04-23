import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || "";
const OUTPUT_DIR = "./twitter-images";

interface MediaItem {
  media_key: string;
  type: string;
  url?: string;
}

interface Tweet {
  id: string;
  text: string;
  attachments?: { media_keys: string[] };
}

interface SearchResponse {
  data?: Tweet[];
  includes?: { media?: MediaItem[] };
  meta?: { next_token?: string; result_count: number };
}

async function searchTweets(
  query: string,
  maxResults = 10,
  nextToken?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    query: `${query} has:images -is:retweet`,
    max_results: String(Math.min(maxResults, 100)),
    expansions: "attachments.media_keys",
    "media.fields": "url,type,width,height",
  });
  if (nextToken) params.set("next_token", nextToken);

  const url = `https://api.twitter.com/2/tweets/search/recent?${params}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { headers: { Authorization: `Bearer ${BEARER_TOKEN}` } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`API error ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
  });
}

async function fetchImages(keyword: string, totalLimit = 50) {
  if (!BEARER_TOKEN) {
    console.error("请设置环境变量 TWITTER_BEARER_TOKEN");
    process.exit(1);
  }

  const dir = path.join(OUTPUT_DIR, keyword.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_"));
  fs.mkdirSync(dir, { recursive: true });

  let downloaded = 0;
  let nextToken: string | undefined;
  const batchSize = Math.min(totalLimit, 10); // 免费版每次最多10条

  console.log(`开始搜索关键词: "${keyword}"`);

  while (downloaded < totalLimit) {
    const response = await searchTweets(keyword, batchSize, nextToken);

    if (!response.data?.length) {
      console.log("没有更多推文");
      break;
    }

    const mediaMap = new Map<string, string>();
    response.includes?.media?.forEach((m) => {
      if (m.type === "photo" && m.url) {
        mediaMap.set(m.media_key, m.url);
      }
    });

    for (const tweet of response.data) {
      if (!tweet.attachments?.media_keys) continue;

      for (const key of tweet.attachments.media_keys) {
        const imageUrl = mediaMap.get(key);
        if (!imageUrl) continue;

        const ext = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
        const filename = `${tweet.id}_${key}.${ext}`;
        const filepath = path.join(dir, filename);

        if (fs.existsSync(filepath)) continue;

        try {
          await downloadImage(imageUrl, filepath);
          downloaded++;
          console.log(`[${downloaded}/${totalLimit}] 下载: ${filename}`);
        } catch (err) {
          console.error(`下载失败: ${imageUrl}`, err);
        }

        if (downloaded >= totalLimit) break;
      }
      if (downloaded >= totalLimit) break;
    }

    nextToken = response.meta?.next_token;
    if (!nextToken) break;

    // 避免触发速率限制
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n完成！共下载 ${downloaded} 张图片到 ${dir}`);
}

// 使用示例: npx ts-node twitter-image-scraper.ts "关键词" 50
const [, , keyword = "photography", limit = "20"] = process.argv;
fetchImages(keyword, parseInt(limit));
