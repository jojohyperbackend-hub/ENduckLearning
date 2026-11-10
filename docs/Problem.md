(venv) PS D:\hachon solid\englishDucAiLms\backend> uvicorn app.main:app --reload
INFO:     Will watch for changes in these directories: ['D:\\hachon solid\\englishDucAiLms\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [14512] using WatchFiles
INFO:     Started server process [13868]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     127.0.0.1:61379 - "OPTIONS /auth/google/callback HTTP/1.1" 200 OK
INFO:     127.0.0.1:53507 - "POST /auth/google/callback HTTP/1.1" 200 OK
INFO:     127.0.0.1:53507 - "POST /auth/google/callback HTTP/1.1" 200 OK
INFO:     127.0.0.1:53507 - "GET /progress/me HTTP/1.1" 401 Unauthorized
INFO:     127.0.0.1:53507 - "GET /courses HTTP/1.1" 401 Unauthorized
INFO:     127.0.0.1:53507 - "GET /courses HTTP/1.1" 401 Unauthorized
INFO:     127.0.0.1:55169 - "GET /ai/quiz/form-options HTTP/1.1" 200 OK
INFO:     127.0.0.1:55169 - "POST /ai/practice/generate HTTP/1.1" 401 Unauthorized
INFO:     127.0.0.1:55169 - "POST /ai/practice/generate HTTP/1.1" 401 Unauthorized


Tuh masih kaya Gini kocak coba luh buat Final biar Gak ada kaya gini luh fix tolol