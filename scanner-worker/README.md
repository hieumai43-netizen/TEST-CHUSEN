# Máy chủ quét Internet/X thật

Worker này nhận yêu cầu từ Chusen Manager, dùng OpenAI Responses API với công cụ web search để tìm website và bài đăng X công khai, sau đó trả dữ liệu có cấu trúc cùng URL nguồn.

## Thiết lập trên Cloudflare

1. Tạo một Cloudflare Worker mới và dùng nội dung `worker.js`.
2. Tạo KV Namespace, gắn binding tên chính xác là `CHUSEN_CACHE`.
3. Tạo API key tại `https://platform.openai.com/api-keys`, sau đó lưu nó thành secret `OPENAI_API_KEY` trong Worker.
4. Tạo một chuỗi bí mật bất kỳ làm secret `SCAN_TOKEN`.
5. Đặt biến `ALLOWED_ORIGIN` bằng domain GitHub Pages của Chusen Manager, ví dụ `https://ten-github.github.io`.
6. Có thể đặt `OPENAI_MODEL`; mặc định là `gpt-5.6`.
7. Thêm Cron Trigger `0 22,10 * * *` để chạy 07:00 và 19:00 giờ Nhật Bản.
8. Deploy Worker, sao chép URL dạng `https://...workers.dev`.
9. Trong Chusen Manager: **Cài đặt → Máy chủ quét Internet/X**, dán URL Worker và cùng mã `SCAN_TOKEN`, sau đó bấm **Kiểm tra**.

## Lưu ý

- ChatGPT Plus và OpenAI API là hai dịch vụ thanh toán riêng.
- API key chỉ đặt trong Worker secret, tuyệt đối không ghi vào `firebase-config.js` hoặc GitHub.
- Web search có thể tìm các trang X công khai được lập chỉ mục, nhưng không bảo đảm thấy mọi bài đăng hoặc bài đăng riêng tư.
- App chỉ coi website thuộc danh sách domain chính thức là độ tin cậy 95%. Bài X được đánh dấu riêng và luôn có nút mở nguồn để kiểm tra.
