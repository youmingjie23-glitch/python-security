# 密碼學實驗室：Fernet 與 RSA-PSS

繁體中文課堂示範網站，可直接放在 **GitHub Pages**。沒有後端、API key、npm 或 CDN。使用瀏覽器內建 Web Crypto 做真正的加密、驗證與簽章；圖片與金鑰在瀏覽器記憶體處理。

## 放到 GitHub，取得網頁網址

1. 新建一個 GitHub repository（一般免費帳號請用 Public），例如 `crypto-demo`。
2. 解壓縮本壓縮檔，**把 `crypto_demo_web` 裡面的內容**上傳到 repository 根目錄。根目錄要直接看到 `index.html`，不是再包一層 `crypto_demo_web`。
3. 點 **Settings → Pages**。
4. 在 **Build and deployment** 的 Source 選 **Deploy from a branch**。
5. Branch 選 **main**，資料夾選 **/(root)**，按 **Save**。
6. 等待部署完成，回 Pages 按 **Visit site**，用顯示的 HTTPS 網址示範。

未替你建立或上傳 GitHub repository。此 ZIP 就是可上傳的完整網站原始碼。

## 本機先試

在這個資料夾開啟 PowerShell：

```powershell
py -m http.server 8000
```

開啟 http://localhost:8000 。Mac / Linux 可用 `python3 -m http.server 8000`。
不要直接雙擊 HTML，也不要用區域網路的 HTTP IP 網址示範；瀏覽器 Web Crypto 需要安全來源（HTTPS 或 localhost）。

## 文字手動竄改

1. 按「產生金鑰並加密」。
2. 複製本次金鑰，貼入「解密金鑰」。先正常解密，確認成功。
3. 在「待解密 token」自行改一個 Base64 字元（英文字、數字、`-`、`_`），再按解密。
4. 也可以展開「手動編輯密文」，把某個 byte 改成另一個值，例如 `7a` 改成 `7b`，保持長度相同，按「套用我編輯的密文」後解密。
5. 顯示 HMAC 驗證失敗。程式只套用你填的資料，**沒有自動竄改按鈕**，也不會重算 HMAC。
6. 「還原原始 token」後可以重做。解密讀取的是目前輸入框，不是暗中使用備份。

亂刪字元可能導致格式錯誤，與「格式正常但 HMAC 不符」是不同結果。請用十六進位編輯器保留長度，能更清楚展示完整性驗證。

## 圖片加密：兩種模式

預設「**像素內容 RGBA**」：將圖片解碼成像素，加密 RGBA 數值與尺寸。透明度也保留。像素模式還原為 PNG，比對的是本瀏覽器解碼後的像素與尺寸；**不宣稱還原原檔位元組、EXIF、壓縮或動畫**（GIF 等只示範解碼的單一畫面）。Canvas 的色彩管理與透明度處理可能影響原始解碼表示。

也可選「**完整圖片檔案**」：加密 PNG/JPG 等完整檔案位元組，解密後與原始檔案逐位元組比對。

兩種都能顯示原圖／真正密文的雜訊預覽／解密圖。預覽最多取 147,456 bytes 的 AES 密文，末端不足補黑。**預覽只是顯示，不是完整的可解密容器**；完整 token 才能解密。

選圖片後按加密，複製金鑰再解密。圖片頁同樣可自行修改完整 token 或密文前 64 bytes。切換模式會清除舊 token，需重新加密。示範限制：檔案 2 MB 以內、解碼後 200 萬像素以內。

## RSA-PSS 手動竄改

1. 產生 RSA 金鑰，輸入原文後按簽章。
2. 按「驗證目前內容」，先確認成功。
3. 把右邊「待驗證文字」的 `100` 自行改成 `1000`，**不要重新簽章**，直接驗證。
4. 顯示 `InvalidSignature`。也可手動修改簽章 Base64，或貼另一把公鑰測試。
5. 按「還原本次原文、公鑰與簽章」，即可再驗證成功。

RSA 2048-bit、SHA-256、MGF1(SHA-256)、PSS saltLength=222，與原 Python 2048-bit RSA / SHA-256 / PSS.MAX_LENGTH 一致。公鑰以 SPKI PEM 呈現。私鑰不顯示、不儲存。

## 檔案整理

保留並整合為 `index.html`、`styles.css`、`crypto.js`、`app.js`、`README.md`、`assets/gun.png`（原來的範例圖）。

此網頁版不再需要：`text_demo.py`、`image_demo.py`、`crypto_gui.py`、`image_noise_demo.py`、`signature_gui.py`（功能已整合）。
移除產出物：`gun.encrypted`、`gun_restored.png`、`image_key.key`。**舊金鑰不放進可公開的網站包。**原始上傳 ZIP 不改動。

不使用 localStorage、cookie、分析服務或外部加密 API。重新整理頁面會清除本次實驗資料。網頁會從同一網站讀取程式與範例圖片；你的圖片不會上傳。這是教學示範，金鑰會在畫面顯示，不適合拿來保管真正的機密資料。

## 原理與參考

- Fernet 格式與金鑰配置：https://github.com/fernet/spec/blob/master/Spec.md
- Python Fernet：https://cryptography.io/en/latest/fernet/
- Python RSA-PSS：https://cryptography.io/en/latest/hazmat/primitives/asymmetric/rsa/
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

Fernet Web 實作先驗 HMAC 再 AES-CBC 解密。時間戳寫入 token，但此示範沒有啟用 TTL 過期限制。沒有加入 ECB 示範，不能用雜訊預覽聲稱做過 ECB/CBC 安全比較。
