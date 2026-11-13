-- 004_translate_answer_alternatives.sql
-- Soal terjemahan dapat beberapa kunci jawaban (dipisah |). Jawaban yang cocok sama salah satu
-- kunci langsung dinilai benar tanpa AI, jadi hasilnya konsisten. Kunci utama tetap di depan.
-- Jalanin SETELAH 003. Aman dijalanin berkali-kali (cuma ngubah baris yang kuncinya masih versi lama).

begin;

update public.exercise set expected_answer = 'I have one younger sister.|I have a younger sister.|I have one little sister.|I have a little sister.'
where type = 'translate' and topic = 'Present Tense (I am, I go, I have)' and question = 'Translate to English: ''Saya punya satu adik perempuan.''' and expected_answer = 'I have one younger sister.';

update public.exercise set expected_answer = 'He went to school yesterday.|She went to school yesterday.|Yesterday he went to school.|Yesterday she went to school.'
where type = 'translate' and topic = 'Past Tense (I was, I went, I had)' and question = 'Translate to English: ''Dia pergi ke sekolah kemarin.''' and expected_answer = 'He went to school yesterday.';

update public.exercise set expected_answer = 'This is my bag.|This bag is mine.'
where type = 'translate' and topic = 'Pronoun & Possessive (I/my, you/your, he/his)' and question = 'Translate to English: ''Ini adalah tas saya.''' and expected_answer = 'This is my bag.';

update public.exercise set expected_answer = 'The dog bites the ball.|The dog is biting the ball.|That dog bites the ball.|That dog is biting the ball.'
where type = 'translate' and topic = 'Simple Sentence Structure (Subject-Verb-Object)' and question = 'Translate to English using Subject-Verb-Object: ''Anjing itu menggigit bola.''' and expected_answer = 'The dog bites the ball.';

update public.exercise set expected_answer = 'Do you like music?'
where type = 'translate' and topic = 'Question & Negative Form (Do/Does, Don''t/Doesn''t)' and question = 'Translate to English: ''Apakah kamu suka musik?''' and expected_answer = 'Do you like music?';

update public.exercise set expected_answer = 'I want to drink hot tea.|I would like to drink hot tea.|I want to drink some hot tea.|I would like some hot tea.|I want some hot tea.'
where type = 'translate' and topic = 'Food & Drink' and question = 'Translate to English: ''Saya mau minum teh panas.''' and expected_answer = 'I want to drink hot tea.';

update public.exercise set expected_answer = 'This is my older brother.|This is my big brother.|This is my elder brother.'
where type = 'translate' and topic = 'Family & People' and question = 'Translate to English: ''Ini adalah kakak laki-laki saya.''' and expected_answer = 'This is my older brother.';

update public.exercise set expected_answer = 'I wake up at six in the morning.|I wake up at six am.|I wake up at six o''clock in the morning.|I get up at six in the morning.|I get up at six am.'
where type = 'translate' and topic = 'Daily Activities (wake up, eat, work, sleep)' and question = 'Translate to English: ''Saya bangun jam enam pagi.''' and expected_answer = 'I wake up at six in the morning.';

update public.exercise set expected_answer = 'It is ten in the morning now.|It is now ten in the morning.|Now it is ten in the morning.|It is ten am now.|It is ten o''clock in the morning now.|It is now ten am.'
where type = 'translate' and topic = 'Numbers & Time' and question = 'Translate to English: ''Sekarang jam sepuluh pagi.''' and expected_answer = 'It is ten in the morning now.';

update public.exercise set expected_answer = 'I go home at five in the afternoon.|I go home at five pm.|I go home at five o''clock in the afternoon.|I come home at five in the afternoon.|I return home at five in the afternoon.|I go home at five in the evening.'
where type = 'translate' and topic = 'Places (home, school, office, market)' and question = 'Translate to English: ''Saya pulang ke rumah jam lima sore.''' and expected_answer = 'I go home at five in the afternoon.';

update public.exercise set expected_answer = 'The cat sleeps on the chair.|The cat is sleeping on the chair.|That cat sleeps on the chair.|That cat is sleeping on the chair.|The cat sleeps on top of the chair.'
where type = 'translate' and topic = 'Terjemahin Kalimat Sederhana' and question = 'Translate to English: ''Kucing itu tidur di atas kursi.''' and expected_answer = 'The cat sleeps on the chair.';

update public.exercise set expected_answer = 'Let me introduce myself, my name is Sari.|Allow me to introduce myself, my name is Sari.|Hello, my name is Sari.|Hi, my name is Sari.'
where type = 'translate' and topic = 'Greeting & Introduction' and question = 'Translate to English: ''Perkenalkan, nama saya Sari.''' and expected_answer = 'Let me introduce myself, my name is Sari.';

update public.exercise set expected_answer = 'Excuse me, where is the bathroom?|Excuse me, where is the restroom?|Excuse me, where is the toilet?|Excuse me, where is the washroom?'
where type = 'translate' and topic = 'Asking for Help / Direction' and question = 'Translate to English: ''Permisi, di mana kamar mandi?''' and expected_answer = 'Excuse me, where is the bathroom?';

update public.exercise set expected_answer = 'How much is this shirt?|How much does this shirt cost?|What is the price of this shirt?|How much are these clothes?|How much is this dress?'
where type = 'translate' and topic = 'Shopping Conversation' and question = 'Translate to English: ''Berapa harga baju ini?''' and expected_answer = 'How much is this shirt?';

update public.exercise set expected_answer = 'My older brother works in an office and he drinks coffee every morning.|My older brother works at an office and he drinks coffee every morning.|My older brother works in an office and drinks coffee every morning.|My big brother works in an office and he drinks coffee every morning.|My elder brother works in an office and he drinks coffee every morning.'
where type = 'translate' and topic = 'Terjemahin Kalimat Campuran (review semua Unit)' and question = 'Translate to English: ''Kakak laki-laki saya bekerja di kantor dan dia minum kopi setiap pagi.''' and expected_answer = 'My older brother works in an office and he drinks coffee every morning.';

commit;

-- Cek: harus keluar 15 baris. jumlah_kunci 2-6, kecuali 'Apakah kamu suka musik?' yang memang 1.
select topic, question, array_length(string_to_array(expected_answer, '|'), 1) as jumlah_kunci
from public.exercise where type = 'translate' order by topic;
