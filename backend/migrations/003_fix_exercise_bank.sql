-- 003_fix_exercise_bank.sql
-- Perbaikan bank soal: petunjuk yang ngasih jawaban, kunci ambigu, pilihan gak masuk akal.
-- Aman dijalanin berkali-kali: tiap UPDATE nyari soal versi LAMA (topic + teks soal lama + jawaban lama).
-- ID soal gak berubah, jadi riwayat Review & attempt tetap nyambung.
-- Jalanin seluruh file sekaligus di Supabase SQL Editor.

begin;

-- Simple Sentence Structure (Subject-Verb-Object): petunjuk (reads) = jawabannya sendiri
update public.exercise set question = 'Fill in the blank: ''He ___ (read) a book every night.''', expected_answer = 'reads'
where topic = 'Simple Sentence Structure (Subject-Verb-Object)' and question = 'Complete the sentence in SVO order: ''He ___ a book.'' (reads)' and expected_answer = 'reads';

-- Question & Negative Form (Do/Does, Don't/Doesn't): 'does not like' juga benar tapi dulu ditolak
update public.exercise set question = 'Fill in the blank: ''He ___ (not/like) spicy food.'' (negative form)', expected_answer = 'doesn''t like|does not like'
where topic = 'Question & Negative Form (Do/Does, Don''t/Doesn''t)' and question = 'Fill in the blank: ''He ___ (not/like) spicy food.'' (negative form)' and expected_answer = 'doesn''t like';

-- Food & Drink: 'I drink a juice' gak wajar (juice gak pakai a)
update public.exercise set question = 'Choose the correct sentence.', expected_answer = 'I drink orange juice.', options = '["I drink rice.", "I eat water.", "I drink orange juice.", "I eat a juice."]'::jsonb
where topic = 'Food & Drink' and question = 'Choose the correct sentence.' and expected_answer = 'I drink a juice.';

-- Food & Drink: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''I would like a cup of ___, please.'' (kopi)', expected_answer = 'coffee'
where topic = 'Food & Drink' and question = 'Fill in the blank: ''I would like a cup of ___ (coffee), please.''' and expected_answer = 'coffee';

-- Food & Drink: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''She is eating ___ for lunch.'' (nasi goreng)', expected_answer = 'fried rice'
where topic = 'Food & Drink' and question = 'Fill in the blank: ''She is eating ___ (fried rice) for lunch.''' and expected_answer = 'fried rice';

-- Family & People: pilihan 'My brother is a she' gak masuk akal
update public.exercise set question = 'Choose the correct sentence.', expected_answer = 'My mother is my father''s wife.', options = '["My mother is my father''s wife.", "My mother is my father''s sister.", "My mother is my father''s son.", "My mother is my father''s brother."]'::jsonb
where topic = 'Family & People' and question = 'Choose the correct sentence.' and expected_answer = 'My brother is a boy.';

-- Family & People: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''My mother''s sister is my ___.'' (tante)', expected_answer = 'aunt'
where topic = 'Family & People' and question = 'Fill in the blank: ''My mother''s sister is my ___ (aunt).''' and expected_answer = 'aunt';

-- Family & People: anak laki-laki ayah bisa diri sendiri, jawabannya ambigu
update public.exercise set question = 'Fill in the blank: ''My uncle''s son is my ___.'' (sepupu)', expected_answer = 'cousin'
where topic = 'Family & People' and question = 'Fill in the blank: ''He is my father''s son, so he is my ___ (brother).''' and expected_answer = 'brother';

-- Daily Activities (wake up, eat, work, sleep): pilihan lain cuma beda logika jam, bukan bahasa
update public.exercise set question = 'Choose the correct sentence.', expected_answer = 'She wakes up at 6 AM.', options = '["She wake up at 6 AM.", "She wakes up at 6 AM.", "She waking up at 6 AM.", "She is wake up at 6 AM."]'::jsonb
where topic = 'Daily Activities (wake up, eat, work, sleep)' and question = 'Choose the correct sentence.' and expected_answer = 'I go to sleep at 10 PM.';

-- Daily Activities (wake up, eat, work, sleep): petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''She usually ___ (wake up) at 6 AM.''', expected_answer = 'wakes up'
where topic = 'Daily Activities (wake up, eat, work, sleep)' and question = 'Fill in the blank: ''I usually ___ (wake up) at 6 AM.''' and expected_answer = 'wake up';

-- Places (home, school, office, market): petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''My father works at the ___ every day.'' (kantor)', expected_answer = 'office'
where topic = 'Places (home, school, office, market)' and question = 'Fill in the blank: ''My father works at the ___ (office) every day.''' and expected_answer = 'office';

-- Places (home, school, office, market): petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''We buy fruits and vegetables at the ___.'' (pasar)', expected_answer = 'market'
where topic = 'Places (home, school, office, market)' and question = 'Fill in the blank: ''We buy fruits and vegetables at the ___ (market).''' and expected_answer = 'market';

-- Greeting & Introduction: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''Nice to ___ you.'' (bertemu)', expected_answer = 'meet'
where topic = 'Greeting & Introduction' and question = 'Fill in the blank: ''Nice to ___ (meet) you.''' and expected_answer = 'meet';

-- Asking for Help / Direction: petunjuk = jawabannya; 'tell' juga benar
update public.exercise set question = 'Fill in the blank: ''Excuse me, could you ___ me the way to the station?'' (menunjukkan)', expected_answer = 'show|tell'
where topic = 'Asking for Help / Direction' and question = 'Fill in the blank: ''Excuse me, could you ___ (show) me the way to the station?''' and expected_answer = 'show';

-- Asking for Help / Direction: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''I am ___, can you help me?'' (tersesat)', expected_answer = 'lost'
where topic = 'Asking for Help / Direction' and question = 'Fill in the blank: ''I am ___ (lost), can you help me?''' and expected_answer = 'lost';

-- Shopping Conversation: petunjuk = jawabannya
update public.exercise set question = 'Fill in the blank: ''I would like to ___ two shirts, please.'' (membeli)', expected_answer = 'buy'
where topic = 'Shopping Conversation' and question = 'Fill in the blank: ''I would like to ___ (buy) two shirts, please.''' and expected_answer = 'buy';

-- Terjemahin Kalimat Campuran (review semua Unit): kunci jawaban campur 'sibling' + 'he', gak konsisten
update public.exercise set question = 'Translate to English: ''Kakak laki-laki saya bekerja di kantor dan dia minum kopi setiap pagi.''', expected_answer = 'My older brother works in an office and he drinks coffee every morning.'
where topic = 'Terjemahin Kalimat Campuran (review semua Unit)' and question = 'Translate to English: ''Kakak saya bekerja di kantor dan dia suka kopi setiap pagi.''' and expected_answer = 'My older sibling works at an office and he likes coffee every morning.';

commit;

-- Cek: harus keluar 17 baris (soal yang sudah versi baru).
select topic, question, expected_answer from public.exercise where
  (topic = 'Simple Sentence Structure (Subject-Verb-Object)' and question = 'Fill in the blank: ''He ___ (read) a book every night.''' and expected_answer = 'reads')
  or (topic = 'Question & Negative Form (Do/Does, Don''t/Doesn''t)' and question = 'Fill in the blank: ''He ___ (not/like) spicy food.'' (negative form)' and expected_answer = 'doesn''t like|does not like')
  or (topic = 'Food & Drink' and question = 'Choose the correct sentence.' and expected_answer = 'I drink orange juice.')
  or (topic = 'Food & Drink' and question = 'Fill in the blank: ''I would like a cup of ___, please.'' (kopi)' and expected_answer = 'coffee')
  or (topic = 'Food & Drink' and question = 'Fill in the blank: ''She is eating ___ for lunch.'' (nasi goreng)' and expected_answer = 'fried rice')
  or (topic = 'Family & People' and question = 'Choose the correct sentence.' and expected_answer = 'My mother is my father''s wife.')
  or (topic = 'Family & People' and question = 'Fill in the blank: ''My mother''s sister is my ___.'' (tante)' and expected_answer = 'aunt')
  or (topic = 'Family & People' and question = 'Fill in the blank: ''My uncle''s son is my ___.'' (sepupu)' and expected_answer = 'cousin')
  or (topic = 'Daily Activities (wake up, eat, work, sleep)' and question = 'Choose the correct sentence.' and expected_answer = 'She wakes up at 6 AM.')
  or (topic = 'Daily Activities (wake up, eat, work, sleep)' and question = 'Fill in the blank: ''She usually ___ (wake up) at 6 AM.''' and expected_answer = 'wakes up')
  or (topic = 'Places (home, school, office, market)' and question = 'Fill in the blank: ''My father works at the ___ every day.'' (kantor)' and expected_answer = 'office')
  or (topic = 'Places (home, school, office, market)' and question = 'Fill in the blank: ''We buy fruits and vegetables at the ___.'' (pasar)' and expected_answer = 'market')
  or (topic = 'Greeting & Introduction' and question = 'Fill in the blank: ''Nice to ___ you.'' (bertemu)' and expected_answer = 'meet')
  or (topic = 'Asking for Help / Direction' and question = 'Fill in the blank: ''Excuse me, could you ___ me the way to the station?'' (menunjukkan)' and expected_answer = 'show|tell')
  or (topic = 'Asking for Help / Direction' and question = 'Fill in the blank: ''I am ___, can you help me?'' (tersesat)' and expected_answer = 'lost')
  or (topic = 'Shopping Conversation' and question = 'Fill in the blank: ''I would like to ___ two shirts, please.'' (membeli)' and expected_answer = 'buy')
  or (topic = 'Terjemahin Kalimat Campuran (review semua Unit)' and question = 'Translate to English: ''Kakak laki-laki saya bekerja di kantor dan dia minum kopi setiap pagi.''' and expected_answer = 'My older brother works in an office and he drinks coffee every morning.')
order by topic;
