# Báo cáo kiểm thử · SuDan Pages 6.0

Ngày: 17/11/2026.

## Đã xác minh

### 1. Kiểm thử lõi và gói triển khai

`npm test`: **16/16 đạt**.

- SRT với UTF-8 BOM, CRLF, nhiều dòng, bắt đầu tại giây 0.
- VTT có cue ID, thiết lập cue và timestamp phút:giây.
- Timestamp làm tròn mili giây, giới hạn và dữ liệu không hợp lệ.
- Xuất SRT gốc/Việt/song ngữ và VTT.
- Ghép bản Việt theo thời gian, từ chối các cue không khớp.
- Dịch mốc thời gian có kiểm tra số âm.
- Cờ kiểm dịch: thiếu bản dịch, trùng nguồn, chồng thời gian.
- CSV có tiếng Việt, escape dấu nháy và ngăn ô công thức.
- ASS với màu BGR, vị trí trên, tiếng Việt/song ngữ, ngăn chèn lệnh styling từ lời thoại nhập vào.
- WAV PCM16 đúng header, sample rate, clipping và giải mã dấu.
- ID của các nút/cài đặt trong HTML khớp mã JS, không trùng.
- Đường dẫn entrypoint tương thích URL có tên repository, không gọi API Python.
- SHA-256 các thư viện khớp manifest; ghép bốn phần WASM cho ra đúng hash WASM gốc.
- Mỗi file trong gói nhỏ hơn giới hạn upload web GitHub 25 MiB.

### 2. FFmpeg WebAssembly thật

`npm run test:media`: **đạt**. Bài kiểm thử nạp chính bốn phần WASM kèm trong gói và thực thi FFmpeg một luồng trong Node, không thay bằng FFmpeg native.

Đã tạo và đọc lại:

- MP4 H.264/AAC 320×180 dài 3 giây.
- Phụ đề tiếng Việt gắn cứng bằng libass, font DejaVu Sans kèm gói. Xem khung hình thấy tiếng Việt hiển thị.
- Trộn tiếng gốc 20% với bản lồng tiếng và giới hạn peak.
- Phụ đề mềm mov_text gắn nhãn ngôn ngữ `vie`.
- Video không có track âm thanh + bản thu bổ sung.
- Tăng tốc giọng bằng `atempo`, pad/cắt chính xác khung 1,5 giây ở 16 kHz.

FFprobe native đọc MP4 đầu ra và xác nhận codec, track phụ đề, độ phân giải, thời lượng. Native FFmpeg chỉ dùng đọc kết quả; phần render trong bài kiểm thử dùng WASM của gói.

### 3. Mô hình AI thật

Đã thực thi chính bundle `@xenova/transformers 2.17.2` và ONNX Runtime WASM kèm gói trong một harness Node mô phỏng môi trường worker, `numThreads=1`, tải các weights công khai thật. Harness ánh xạ fetch WASM sang file trên đĩa; đây là kiểm thử runtime mô hình, không phải kiểm thử UI/trình duyệt.

- **MMS tiếng Việt:** câu “Xin chào, đây là SuDan Studio.” tạo được **43.264 mẫu âm thanh, 16.000 Hz**, xuất WAV thật.
- **Whisper Tiny:** nhận diện lại WAV trên, trả về text và mốc thời gian. Nội dung nghe sai một số từ/tên riêng (“Sinh Chào đây là Sinh Em Sinh Đương.”), minh họa cần nghe kiểm tra và sửa thủ công; không dùng kết quả này để khẳng định độ chính xác.
- **NLLB Anh → Việt:** “Hello, welcome to our studio.” → “Chào, chào mừng đến với phòng thu của chúng tôi.”
- **NLLB Trung → Việt:** “你好，欢迎来到我们的工作室。” → “Chào, chào đón đến phòng thu của chúng tôi.”

Dung lượng weights quantized quan sát được (MiB): Whisper Tiny encoder 9,7 + decoder 29,3; MMS 36,6; NLLB encoder 399,7 + decoder 453,5; chưa gồm tokenizer/config. NLLB được hiển thị khoảng 900 MB trong giao diện để phản ánh tải thực tế.

## Chưa xác minh

- Xem và thao tác trực tiếp giao diện trên Chrome/Edge/Safari: dịch vụ relay của môi trường xem trước không mở được cổng 4173. Khởi động desktop rồi thử lại vẫn gặp cùng lỗi. Chưa có xác nhận end-to-end luồng chọn file, worker, tải xuống hay bố cục responsive trên trình duyệt thật.
- Triển khai trực tiếp lên tài khoản GitHub của người dùng; chưa có repository hay URL Pages thực tế.
- Hiệu năng, bộ nhớ và tốc độ với video 20 phút/200 MiB; các ngưỡng là giới hạn bảo vệ, không phải cam kết mọi máy đều chạy được.
- AI với phim dài, nhận diện nhiều vai, chất lượng dịch theo ngữ cảnh; giọng nam/nữ và tăng tốc NVIDIA không thuộc bản web này.
- Không có benchmark khẳng định nhanh hơn thời gian thực. Điện thoại/máy ít RAM có thể không chạy được NLLB.

## Smoke test nên chạy sau khi bật Pages

1. Mở URL `https://USER.github.io/REPO/` trên Chrome/Edge.
2. Chọn `examples/clip-thu.mp4`, nhập hai file SRT mẫu, đổi cỡ/màu và phát xem trước.
3. Xuất SRT/CSV/JSON, tải lại JSON; thử tìm/sửa, đổi thời gian.
4. Tạo giọng từ một câu Việt ngắn, nghe và tải WAV.
5. Xuất MP4 có giọng/phụ đề, tải MP4 về và mở lại.
6. Dùng clip có lời thoại 30–60 giây để thử Whisper và dịch NLLB. Kiểm tra tên riêng thủ công.
7. Thử dừng tác vụ AI rồi chạy lại; tải lại trang và chọn lại media để kiểm tra khôi phục văn bản.
