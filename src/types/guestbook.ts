export type Issue = {
  id: number;
  html_url: string;
  title: string;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  created_at: string;
  body: string;
  comments: number;
};
