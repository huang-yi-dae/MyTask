// 废弃的设计预览路由，重定向到首页
import { redirect } from "next/navigation";
export default function PreviewBPage() {
  redirect("/");
}
