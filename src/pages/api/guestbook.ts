import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 只接受 POST 请求
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ message: "留言内容不能为空" });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(500).json({ message: "GitHub Token 未配置" });
  }

  const repo = "woshidashuaibi-lsj/lusuijie-blog";
  const url = `https://api.github.com/repos/${repo}/issues`;

  try {
    const githubRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${githubToken}`,
      },
      body: JSON.stringify({
        title: `来自留言板的新留言`,
        body: message,
        labels: ["guestbook"], // 自动打上 guestbook 标签
      }),
    });

    if (!githubRes.ok) {
      const errorData = await githubRes.json();
      console.error("GitHub API Error:", errorData);
      return res
        .status(githubRes.status)
        .json({ message: "提交到 GitHub 失败" });
    }

    const newIssue = await githubRes.json();
    return res.status(201).json({ message: "留言成功！", issue: newIssue });
  } catch (error) {
    console.error("Request to GitHub failed:", error);
    return res.status(500).json({ message: "服务器内部错误" });
  }
}
