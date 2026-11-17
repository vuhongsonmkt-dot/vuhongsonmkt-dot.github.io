# SuDan Video Studio · GitHub Pages 6.0

Bản web viết lại từ SuDan Video Studio Windows v5.3 do bạn cung cấp. Chạy trực tiếp trên GitHub Pages bằng HTML/JavaScript, Web Workers và WebAssembly. Không có máy chủ Python, không cần VPS, không cần API key.

**Địa chỉ sau khi bật Pages:** `https://TEN-TAI-KHOAN.github.io/TEN-REPO/`.

## Đưa lên GitHub: cách dễ nhất

1. Giải nén ZIP. Mở thư mục `SuDan-GitHub-Pages` bên trong.
2. Đăng nhập GitHub, tạo repository mới, ví dụ `sudan-studio`. Với tài khoản GitHub Free, hãy chọn **Public** để dùng Pages miễn phí. Không thêm video riêng tư vào repository.
3. Trong repository, chọn **Add file → Upload files**. Kéo **toàn bộ các file và thư mục bên trong** `SuDan-GitHub-Pages` vào. Không kéo cả thư mục cha vì `index.html` cần nằm ngay ở gốc repository. Giữ đầy đủ `assets/`, `lib/` và `vendor/`.
4. Bấm **Commit changes**. Đợi tải và commit xong.
5. Vào **Settings → Pages → Build and deployment**. Chọn **Source: Deploy from a branch**, **Branch: main**, thư mục **/(root)**, rồi **Save**.
6. Đợi GitHub triển khai xong. Mở link mà trang Pages hiển thị, thường là `https://TEN-TAI-KHOAN.github.io/sudan-studio/`.

Nếu GitHub chưa có nút Upload files vì repository đang trống, dùng liên kết **uploading an existing file** trên trang khởi tạo. Bạn cũng có thể dùng GitHub Desktop để chọn thư mục, commit và publish repository. Mỗi file trong gói dưới 25 MiB để có thể tải qua web. Không tải nguyên file ZIP vào repository vì GitHub Pages không tự giải nén ZIP.

Gói có `.nojekyll`. Nếu công cụ upload không hiển thị file ẩn, tạo file `.nojekyll` rỗng bằng **Add file → Create new file**. Giữ cả bốn file `vendor/ffmpeg/ffmpeg-core.part*.wasm`: ứng dụng ghép chúng khi nạp để tránh giới hạn 25 MiB/file của giao diện upload GitHub.

## Triển khai bằng GitHub Actions (tùy chọn)

File workflow `.github/workflows/pages.yml` đi kèm hỗ trợ kiểm thử trước khi deploy. Nếu chọn cách này, vào **Settings → Pages → Source: GitHub Actions**, mở **Actions → Deploy SuDan to GitHub Pages → Run workflow**. Nếu chỉ dùng cách “Deploy from a branch” phía trên thì không cần thêm workflow vào repository.

## Dùng app

1. Mở link Pages bằng Chrome/Edge mới trên máy tính. Giữ tab mở khi chạy AI và xuất video.
2. Chọn MP4 H.264/AAC hoặc WebM có thể phát trên trình duyệt. Video được đọc từ thiết bị, không tải lên GitHub.
3. Nhập SRT/VTT gốc; hoặc chọn đúng ngôn ngữ Trung/Anh/Việt rồi bấm **Nhận diện lời thoại**. Whisper Tiny chạy tại thiết bị.
4. Với nguồn Trung/Anh, bấm **Dịch sang Việt**. NLLB chỉ dịch các câu chưa có bản Việt để giữ chỉnh sửa thủ công. Muốn dịch lại câu nào, xóa cột Tiếng Việt câu đó rồi chạy dịch lại.
5. Kiểm tra và sửa nguyên văn, bản Việt, thời gian. Bấm ▶ cạnh mỗi câu để phát video từ mốc tương ứng. Có thể tìm, lọc các câu đáng nghi, dịch mốc thời gian và tìm/thay.
6. Sang **Giọng Việt**, tạo WAV bằng MMS hoặc nhập bản thu WAV/MP3/M4A của bạn. Giọng được căn theo từng câu: tăng tốc tối đa 2× nếu quá dài, phần còn dư bị cắt và được báo trong nhật ký. Rút gọn bản Việt khi cần.
7. Sang **Xuất file**, chọn tiếng Việt/nguyên văn/song ngữ, kiểu chữ và xuất MP4 H.264/AAC. Có phụ đề cứng hoặc phụ đề mềm; có thể trộn tiếng gốc với bản lồng tiếng. Nếu không muốn phụ đề, chọn **Không phụ đề**.
8. Tải SRT/VTT/ASS hoặc CSV kiểm dịch nếu không cần render. Nút **Lưu dự án** tải JSON gồm nội dung, thời gian và cài đặt; không chứa video/âm thanh.

SRT/VTT bản Việt sẽ được ghép theo mốc bắt đầu/kết thúc với sai lệch tối đa 0,3 giây. Nếu hai file có mốc khác nhau, hãy sửa mốc trước hoặc nhập bản Việt vào dự án trống. Khi xuất phụ đề, app dùng đúng cột được chọn, không tự thay bản dịch trống bằng nguyên văn.

## Thử nhanh bằng file mẫu

Thư mục `examples/` có `clip-thu.mp4` dài 3 giây, `phu-de-goc.srt`, `phu-de-viet.srt` và `ket-qua-thu.mp4` đã render. Chọn clip, nhập hai file SRT, sau đó xuất MP4 để thử mà không tải AI. Clip dùng âm tone, không có lời nói để nhận diện.

## Các chức năng đã chuyển sang web

- Mở một video và xem trước phụ đề.
- Nhập, sửa, thêm/xóa, tìm và dịch mốc phụ đề SRT/VTT.
- Whisper Tiny đa ngôn ngữ: nhận diện tiếng Trung, Anh hoặc Việt.
- NLLB: dịch Trung/Anh sang Việt tại thiết bị.
- MMS tiếng Việt: tạo file WAV thật để ghép vào video.
- Nhập bản thu, trộn tiếng gốc và lồng tiếng.
- Xuất MP4 có phụ đề tiếng Việt cứng/mềm, SRT, VTT, ASS, CSV.
- Kiểm tra dấu hiệu thiếu dịch, trùng nguyên văn, còn chữ Trung, câu khó đọc kịp hoặc chồng thời gian. Đây là gợi ý để xem lại, không phải đánh giá đúng/sai nội dung.
- Tự lưu văn bản vào IndexedDB trên trình duyệt; lưu/mở dự án JSON.
- Có dữ liệu phụ đề mẫu để thử trước khi dùng AI.

## Giới hạn thực tế

Đây là **bản web chạy tại thiết bị**, không phải đưa Python nguyên bản lên GitHub. GitHub chỉ phục vụ file web. Khi bạn đóng máy hoặc đóng tab, việc xử lý dừng.

- Giới hạn video **200 MiB/file**; AI, tạo WAV và xuất video tối đa **20 phút/dự án**. Máy yếu vẫn có thể hết RAM với clip dưới giới hạn. Bắt đầu bằng 30–60 giây; máy tính RAM 8 GB trở lên sẽ phù hợp hơn, đặc biệt khi dùng NLLB.
- AI chạy CPU WebAssembly một luồng để tương thích GitHub Pages mà không cần thiết lập COOP/COEP. Có thể chậm hơn thời lượng video; không có tốc độ NVIDIA như bản Windows.
- Lần đầu cần Internet để tải mô hình từ Hugging Face. Whisper Tiny khoảng 40–50 MB, NLLB khoảng 900 MB, MMS tiếng Việt khoảng 30–40 MB. Kích thước thực có thể thay đổi theo mô hình. Trình duyệt có thể cache mô hình, nhưng có thể xóa khi thiếu dung lượng. Mã JS, FFmpeg, ONNX Runtime và font đã kèm trong gói.
- Mô hình Tiny nhỏ, có thể nghe sai. Dịch máy và giọng MMS cần được xem/nghe lại; không cam kết chất lượng tương đương Whisper Small/Edge/VieNeu của bản Windows.
- Một giọng MMS Việt; chưa có chọn nam/nữ hay nhận diện vai. Giọng của hệ điều hành qua SpeechSynthesis chỉ dùng nghe thử, không xuất WAV.
- Chưa có xử lý hàng loạt nhiều tập, ghép bộ phim dài, chọn GPU, xóa logo, tự sửa bộ cài Windows hay xuất H.265. Các chức năng chỉ chạy được ở Python không được để lại dưới dạng nút giả.
- Video/audio không tự lưu lâu dài. Sau khi tải lại trang, chọn lại video và tạo/nhập lại giọng; nhớ tải WAV/MP4 khi hoàn thành. Sửa mốc hoặc bản Việt sẽ bỏ bản giọng AI cũ để tránh dùng nhầm giọng chưa cập nhật.
- MP4 dùng xử lý trong RAM. Nên giảm độ phân giải 480p/720p và dùng từng clip ngắn.
- Trên iPhone/Safari/điện thoại, khả năng WASM, RAM và codec có thể hạn chế. Nếu máy không chạy được NLLB, vẫn nhập bản dịch SRT có sẵn để biên tập/xuất.
- Muốn dùng thương mại với các mô hình AI, kiểm tra giấy phép NLLB/MMS; hai mô hình này có điều kiện phi thương mại. Chi tiết trong `THIRD_PARTY.md`.

## Quyền riêng tư

App không có API key, tài khoản hoặc dịch vụ gửi video đi. Khi bấm AI, trình duyệt tải file mô hình từ Hugging Face; host đó thấy yêu cầu mạng tải mô hình. Việc nhận diện, dịch, tạo giọng và render diễn ra trên thiết bị. GitHub thấy các yêu cầu tải trang và thư viện như website thông thường. Giọng nghe thử của hệ điều hành có thể dùng dịch vụ do nhà cung cấp trình duyệt/giọng quyết định.

Văn bản tự lưu chỉ ở trình duyệt trên thiết bị hiện tại, không đồng bộ giữa thiết bị. Dùng **Dự án mới** để xóa nội dung dự án hiện tại, hoặc xóa dữ liệu trang trong cài đặt trình duyệt. File JSON do bạn tải vẫn nằm ở nơi bạn lưu.

## Khắc phục sự cố

- **404 trang:** kiểm tra `index.html` ở gốc và Pages chọn đúng main + /(root). Đợi triển khai thành công trong Actions.
- **Không tải được FFmpeg:** kiểm tra bốn file `ffmpeg-core.part*.wasm`, `wasm-parts.json` và toàn bộ `vendor/ffmpeg/` đã được upload. Không đổi tên file.
- **Không chạy khi nhấp đúp index.html:** ES modules/worker cần HTTP(S); mở bằng link GitHub Pages. Muốn thử tại máy, từ thư mục app chạy `python -m http.server 8080` rồi mở `http://localhost:8080` (Python chỉ dùng làm server thử, không cần trên GitHub).
- **AI không tải được:** kiểm tra mạng có truy cập được Hugging Face, dung lượng trống và RAM; mở Nhật ký xử lý. Nếu đã tải lỗi, reload trang rồi thử lại.
- **Tab bị đóng/hết RAM:** cắt video ngắn hơn, giảm kích thước/độ phân giải hoặc nhập SRT thay vì nhận diện; bấm dừng, đóng các tab nặng rồi tải lại app.
- **Không có tiếng nhận diện:** video cần có track âm thanh. Video chỉ có hình vẫn xuất được với bản thu nhập vào.
- **Giọng bị cắt:** rút gọn bản Việt hoặc kéo dài mốc kết thúc mà không chồng câu; tạo lại WAV.
- **SRT tiếng Việt không hiển thị:** chọn đúng nội dung phụ đề; phải có văn bản trong cột Tiếng Việt. Chọn Nguyên văn để xem phụ đề gốc.
- **Tự lưu không khả dụng:** trình duyệt riêng tư hoặc giới hạn lưu trữ có thể chặn IndexedDB. Tải JSON để giữ dự án.

## Kiểm thử cho người phát triển

Không cần `npm install` để chạy app hay test lõi. Cần Node 20+ để chạy:

```sh
npm test
npm run test:media
```

Xem `TEST_REPORT.md` để biết các phần đã được xác minh và phần chưa kiểm tra được. Mã nguồn nằm trong `app.js`, `ai-worker.js`, `lib/`. Thư viện đã ghim phiên bản trong `vendor/SOURCES.json`. Không đưa các file video người dùng hoặc cache mô hình vào repository.
