/* ============================================================
   LANGUAGE-PACK-CEB.JS — the Cebuano starter pack
   ------------------------------------------------------------
   A core vocabulary for Cebuano (Bisaya), organised the way somebody actually
   learns to speak rather than alphabetically: the structural words first, then
   the topics you need on day one, then the long tail.

   WHY THE FUNCTION WORDS COME FIRST. A thousand nouns will not make you
   understood in Cebuano; the particles will. `na`, `pa`, `man`, `ba`, `lang`,
   `gyud`, `kaayo`, `nga`, `ug` and the pronoun sets are what separate somebody
   reciting vocabulary from somebody talking, and they are also the part a
   dictionary teaches worst. Every one of them here carries a description of
   what it DOES, not just an English word it is sometimes swapped for -- most
   of them have no clean English equivalent at all.

   FORMAT. Each group is { g, tags, w } where w is a list of compact rows:

       [ceb, en, description, example?, note?]

       ceb          the Cebuano term
       en           the closest English handle -- a label, not a definition
       description  what it means and when it is used
       example      'Cebuano sentence|English sentence', optional
       note         a usage restriction or warning, optional

   The array form is deliberate: at this size an object per field would be
   thousands of lines of punctuation, and the builder below turns each row into
   the same record shape langSaveWord expects.

   ACCURACY. This is a learning pack, so a wrong gloss actively teaches the
   wrong thing. Entries are limited to vocabulary that is in common use and
   unambiguous. Where a word is regional, or where Cebuano makes a distinction
   English does not, the note says so rather than the pack pretending the two
   languages line up.
   ============================================================ */

const LANG_CEB_PACK = [

/* ── The words that hold sentences together ─────────────────── */
{ g: 'Particles', tags: ['particles', 'core'], w: [
  ['na', 'already / now', 'Marks a change of state — something has happened, or is now the case. One of the two most common words in Cebuano.', 'Nahuman na.|It is finished already.', 'Pairs with "pa" as a set: "na" is the change, "pa" is the continuation.'],
  ['pa', 'still / yet / more', 'Marks continuation — something is still the case, or there is more of it.', 'Gamay pa.|A little more.', 'With a negative it means "not yet": "Wala pa" — not yet.'],
  ['ba', '(question marker)', 'Turns a statement into a yes/no question. It has no English word; English uses word order instead.', 'Gutom ka ba?|Are you hungry?', 'Optional in speech — a rising tone does the same job — but very common.'],
  ['man', '(softener / contrast)', 'Softens a statement or marks mild contrast or explanation. Roughly the work English does with "well" or "but".', 'Wala man ko kabalo.|Well, I did not know.', 'Also forms question words: "ngano man" — why, then?'],
  ['lang', 'just / only', 'Limits or downplays. Extremely common, and often used for politeness rather than quantity.', 'Gamay lang.|Just a little.', 'Written "lamang" in formal Cebuano; nobody says that in conversation.'],
  ['gyud', 'really / indeed', 'Emphasis — confirms or insists. Spelled "gyud", "jud" or "gid" depending on who is writing.', 'Lami gyud!|It is really delicious!', 'The single most Cebuano-sounding word in the language. Using it well marks you out.'],
  ['kaayo', 'very', 'Intensifier, placed AFTER the word it strengthens.', 'Nindot kaayo.|Very beautiful.', 'Position matters: "kaayo nindot" is wrong.'],
  ['nga', '(linker)', 'Links a describing word to what it describes, and introduces clauses. Required, not optional.', 'Dako nga balay.|A big house.', 'Shortens to "ng" after a vowel: "dakong balay".'],
  ['ug', 'and / (object marker)', 'Joins words, and also marks an indefinite object after a verb.', 'Mipalit ko ug pan.|I bought some bread.', 'Pronounced "og". A very different word from "ug" meaning "and" in writing, but spelled the same.'],
  ['og', 'and / of', 'The spoken spelling of "ug". You will see both.', 'Tinapay og gatas.|Bread and milk.', ''],
  ['o', 'or', 'Offers an alternative.', 'Kape o tsa?|Coffee or tea?', ''],
  ['pero', 'but', 'Contrast. Borrowed from Spanish and completely naturalised.', 'Gusto ko, pero busy ko.|I want to, but I am busy.', '"Apan" is the formal native equivalent, rare in speech.'],
  ['kay', 'because / than', 'Gives a reason, and also marks the second half of a comparison.', 'Wala ko miadto kay nag-ulan.|I did not go because it was raining.', ''],
  ['aron', 'so that / in order to', 'Introduces a purpose.', 'Nagtuon ko aron makapasar.|I studied so that I could pass.', ''],
  ['kung', 'if / when', 'Introduces a condition.', 'Kung gusto ka, adto ta.|If you want, let us go.', 'Also spelled "kon".'],
  ['basta', 'as long as / provided that', 'Sets a condition informally, often with a note of insistence.', 'Basta mouban ka.|As long as you come along.', ''],
  ['unya', 'then / later', 'Sequences events, or means "later on".', 'Unya na lang.|Later, then.', ''],
  ['usab', 'also / again', 'Adds to something already said. Usually shortened to "sab" or "pud" in speech.', 'Ako usab.|Me too.', ''],
  ['pud', 'also / too', 'The spoken form of "usab". Very common.', 'Ikaw pud?|You too?', 'Also written "sad" or "sab".'],
  ['ra', 'only / just', 'Close to "lang", slightly more limiting.', 'Duha ra.|Only two.', ''],
  ['diay', '(realisation)', 'Marks something newly understood — "oh, so it is like that".', 'Ikaw diay!|Oh, it is you!', 'No English equivalent; English uses tone.'],
  ['tingali', 'maybe / perhaps', 'Marks uncertainty.', 'Moabot tingali siya ugma.|He will perhaps arrive tomorrow.', ''],
  ['siguro', 'probably / maybe', 'Uncertainty, from Spanish. Slightly more confident than "tingali".', 'Siguro tinuod.|It is probably true.', ''],
  ['dayon', 'right away / go ahead', 'Immediacy. Also used alone as an invitation to come in or proceed.', 'Dayon!|Come in!', ''],
  ['pananglitan', 'for example', 'Introduces an example.', 'Pananglitan, ang mangga.|For example, the mango.', 'Formal; "sama sa" is commoner in speech.'],
]},

/* ── Pronouns: the part of Cebuano that trips everyone ───────── */
{ g: 'Pronouns', tags: ['pronouns', 'core'], w: [
  ['ako', 'I', 'The full form of the first person. Used for emphasis or at the start of a sentence.', 'Ako si Juan.|I am Juan.', 'Cebuano pronouns come in three sets by role; this is the topic set.'],
  ['ko', 'I / me', 'The short form of "ako", used after the verb. This is what you will say most of the time.', 'Gutom ko.|I am hungry.', ''],
  ['nako', 'my / by me', 'The possessive and actor form of the first person.', 'Balay nako.|My house.', 'Also written "nako\'" — the same word.'],
  ['kanako', 'to me', 'The first person as a destination or indirect object.', 'Ihatag kanako.|Give it to me.', ''],
  ['ikaw', 'you', 'The full second-person singular, for emphasis or sentence-initial position.', 'Ikaw ba?|Is it you?', ''],
  ['ka', 'you / (counting linker)', 'Two jobs. As a pronoun it is the short "you", used after the verb. It is ALSO the linker that sits between a number and what is counted, where it is not optional.', 'Kumusta ka? / Tulo ka libro.|How are you? / Three books.', 'Same spelling, unrelated jobs. "Tulo libro" without the linker is ungrammatical.'],
  ['nimo', 'your / by you', 'Second-person possessive and actor form.', 'Ngalan nimo?|Your name?', ''],
  ['kanimo', 'to you', 'Second person as a destination.', 'Para kanimo.|For you.', ''],
  ['siya', 'he / she', 'Third person singular. Cebuano does not mark gender — one word covers both.', 'Siya ang akong igsoon.|He is my sibling.', 'A genuine difference from English: you cannot tell gender from the pronoun.'],
  ['niya', 'his / her / by him', 'Third-person possessive and actor form.', 'Libro niya.|His book.', ''],
  ['kaniya', 'to him / to her', 'Third person as a destination.', 'Isulti kaniya.|Tell him.', ''],
  ['kami', 'we (not you)', 'First person plural EXCLUDING the listener.', 'Kami ang miadto.|We were the ones who went.', 'Cebuano splits "we" in two. Getting this wrong is the classic learner error.'],
  ['kita', 'we (including you) / see', 'As a pronoun, the first person plural INCLUDING the listener. As a verb, to see or to meet.', 'Kita tanan. / Magkita ta ugma.|All of us. / Let us meet tomorrow.', 'If the person you are talking to is coming along it is "kita", not "kami". The verb is a separate word that happens to be spelled the same.'],
  ['ta', 'we (including you)', 'The short form of "kita", used after the verb.', 'Adto ta.|Let us go.', ''],
  ['namo', 'our (not yours)', 'Exclusive first-person plural possessive.', 'Balay namo.|Our house (not yours).', ''],
  ['nato', 'our (including yours)', 'Inclusive first-person plural possessive.', 'Yuta nato.|Our land (yours and mine).', ''],
  ['kamo', 'you (plural)', 'Second person plural.', 'Kamo ba ang mga bisita?|Are you the guests?', ''],
  ['mo', 'you (plural, short)', 'The short second-person plural.', 'Asa mo?|Where are you all going?', ''],
  ['ninyo', 'your (plural)', 'Second-person plural possessive.', 'Balay ninyo.|Your house (all of you).', ''],
  ['sila', 'they', 'Third person plural.', 'Sila ang nag-abot.|They are the ones who arrived.', ''],
  ['nila', 'their / by them', 'Third-person plural possessive and actor form.', 'Sakyanan nila.|Their vehicle.', ''],
  ['kanila', 'to them', 'Third person plural as a destination.', 'Ihatag kanila.|Give it to them.', ''],
  ['akoa', 'mine', 'A standalone possessive — used where English says "mine" rather than "my".', 'Akoa na.|It is mine now.', ''],
  ['imoha', 'yours', 'Standalone second-person possessive.', 'Imoha ni?|Is this yours?', 'Also "imo".'],
]},

/* ── Pointing at things ──────────────────────────────────────── */
{ g: 'This and that', tags: ['deictics', 'core'], w: [
  ['kini', 'this', 'Near the speaker. Cebuano has three distances where English has two.', 'Kini ang akoa.|This is mine.', 'Often shortened to "ni" in speech.'],
  ['kana', 'that (near you)', 'Near the listener — the middle distance English lacks.', 'Kana ba?|That one?', 'Shortened to "na". The three-way split is a real difference from English.'],
  ['kadto', 'that (over there)', 'Far from both speaker and listener.', 'Kadto ang balay nila.|That over there is their house.', 'Shortened to "to".'],
  ['dinhi', 'here', 'At the speaker.', 'Dinhi ko.|I am here.', 'Also "diri".'],
  ['diha', 'there (near you)', 'At the listener.', 'Ibutang diha.|Put it there.', ''],
  ['didto', 'there (over there)', 'Away from both.', 'Didto siya sa Cebu.|He is over there in Cebu.', ''],
  ['ari', 'come here', 'Movement toward the speaker.', 'Ari ka.|Come here.', ''],
  ['adto', 'go there', 'Movement away, to a far place.', 'Adto ta sa merkado.|Let us go to the market.', ''],
  ['ingon niini', 'like this', 'Manner, near.', 'Buhata ingon niini.|Do it like this.', ''],
]},

/* ── Questions ───────────────────────────────────────────────── */
{ g: 'Question words', tags: ['questions', 'core'], w: [
  ['unsa', 'what', 'Asks about a thing.', 'Unsa ni?|What is this?', ''],
  ['kinsa', 'who', 'Asks about a person.', 'Kinsa ka?|Who are you?', 'For people only — "unsa" for things.'],
  ['asa', 'where (going)', 'Asks a destination, or where something is.', 'Asa ka padulong?|Where are you headed?', 'Pairs with "diin"; "asa" is the everyday one.'],
  ['diin', 'where (located)', 'Asks a location. Slightly more formal than "asa".', 'Diin ka nagpuyo?|Where do you live?', ''],
  ['kanus-a', 'when', 'Asks about time.', 'Kanus-a ka moabot?|When will you arrive?', ''],
  ['ngano', 'why', 'Asks a reason.', 'Ngano man?|Why, though?', 'Almost always followed by "man".'],
  ['unsaon', 'how (to do)', 'Asks about method.', 'Unsaon nako pag-adto?|How do I get there?', ''],
  ['kumusta', 'how (is it)', 'Asks about state or condition. Also the standard greeting.', 'Kumusta ang trabaho?|How is work?', 'From Spanish "cómo está".'],
  ['pila', 'how many / how much', 'Asks a quantity or a price.', 'Pila ni?|How much is this?', 'The single most useful question word in a market.'],
  ['unsa nga oras', 'what time', 'Asks the clock time.', 'Unsa nga oras na?|What time is it?', 'Often shortened to "unsang oras".'],
  ['hain', 'where is', 'Asks the location of a specific thing.', 'Hain ang yawe?|Where is the key?', ''],
]},

/* ── Yes, no, and getting by ─────────────────────────────────── */
{ g: 'Yes and no', tags: ['core', 'essentials'], w: [
  ['oo', 'yes', 'Plain agreement.', 'Oo, tinuod.|Yes, it is true.', 'Say "oo" to friends and "opo"-style politeness is Tagalog, not Cebuano.'],
  ['dili', 'no / not', 'Negates a description, an identity, or a future action.', 'Dili ko gusto.|I do not want to.', 'Use "dili" for "is not"; use "wala" for "there is not" and for the past.'],
  ['wala', 'none / not / left', 'Negates existence or possession, and negates completed actions. Quite separately, it is also the left-hand side.', 'Wala koy kwarta. / Liko sa wala.|I have no money. / Turn left.', 'Two things to watch: the "dili" / "wala" split is the commonest learner mistake, and "wala" meaning left is an unrelated word with the same spelling.'],
  ['ayaw', 'do not', 'Negative command.', 'Ayaw paghilak.|Do not cry.', 'Only for commands; "dili" for statements.'],
  ['sige', 'okay / go on', 'Agreement, permission, or encouragement to continue. Extremely common.', 'Sige, salamat.|Okay, thanks.', 'Also a goodbye: "Sige, una ko."'],
  ['ambot', 'I do not know', 'A complete answer on its own. Can sound curt if said flatly.', 'Ambot lagi.|I really do not know.', ''],
  ['basin', 'perhaps / it might be', 'Softer speculation.', 'Basin moabot siya.|He might come.', ''],
]},

/* ── Greetings and courtesy ──────────────────────────────────── */
{ g: 'Greetings', tags: ['greetings', 'essentials'], w: [
  ['maayong buntag', 'good morning', 'Used from waking until about eleven.', 'Maayong buntag, Nang.|Good morning, ma\'am.', ''],
  ['maayong udto', 'good noon', 'Around midday — a greeting English does not have.', 'Maayong udto.|Good noon.', ''],
  ['maayong hapon', 'good afternoon', 'From about one until dusk.', 'Maayong hapon, Dong.|Good afternoon, lad.', ''],
  ['maayong gabii', 'good evening', 'After dark. Also used as good night.', 'Maayong gabii.|Good evening.', ''],
  ['kumusta ka', 'how are you', 'The standard greeting to one person.', 'Kumusta ka, migo?|How are you, friend?', ''],
  ['maayo man', 'I am fine', 'The standard answer.', 'Maayo man, salamat.|I am fine, thank you.', ''],
  ['salamat', 'thank you', 'Thanks.', 'Salamat kaayo.|Thank you very much.', ''],
  ['walay sapayan', 'you are welcome', 'The reply to thanks. Literally "no matter".', 'Walay sapayan.|You are welcome.', ''],
  ['palihug', 'please', 'Softens a request. Also means "to ask a favour".', 'Palihug ko.|Please help me.', ''],
  ['pasaylo-a ko', 'forgive me', 'A real apology, for something you did.', 'Pasaylo-a ko.|Forgive me.', ''],
  ['sorry', 'sorry', 'Borrowed and universal, used for small apologies.', 'Sorry, nalimot ko.|Sorry, I forgot.', 'English words are normal in everyday Cebuano; using them is not a failure.'],
  ['ayo-ayo', 'take care', 'Said on parting.', 'Ayo-ayo sa dalan.|Take care on the road.', ''],
  ['amping', 'take care / be careful', 'Warmer than "ayo-ayo", said to someone you care about.', 'Amping ka.|Take care of yourself.', ''],
  ['adto na ko', 'I am going now', 'The normal way to leave.', 'Adto na ko, ha.|I am off now.', ''],
  ['una ko', 'I will go ahead', 'Said when leaving before the others.', 'Una ko, sige.|I will head off, then.', ''],
  ['maayong pag-abot', 'welcome', 'Said to someone arriving.', 'Maayong pag-abot!|Welcome!', ''],
  ['pagkaon ta', 'let us eat', 'The invitation to a shared meal.', 'Dali, pagkaon ta.|Come, let us eat.', 'Refusing outright is rude; "sunod na lang" softens it.'],
]},

/* ── Counting ────────────────────────────────────────────────── */
{ g: 'Numbers', tags: ['numbers', 'core'], w: [
  ['usa', 'one', 'The number one.', 'Usa ka tuig.|One year.', 'Cebuano uses native numbers for counting things and Spanish ones for money and time.'],
  ['duha', 'two', 'The number two.', 'Duha ka tawo.|Two people.', ''],
  ['tulo', 'three', 'The number three.', 'Tulo ka adlaw.|Three days.', ''],
  ['upat', 'four', 'The number four.', 'Upat ka bulan.|Four months.', ''],
  ['lima', 'five', 'The number five.', 'Lima ka piso.|Five pesos.', ''],
  ['unom', 'six', 'The number six.', 'Unom ka bata.|Six children.', ''],
  ['pito', 'seven', 'The number seven.', 'Pito ka adlaw sa semana.|Seven days in a week.', ''],
  ['walo', 'eight', 'The number eight.', 'Walo ka oras.|Eight hours.', ''],
  ['siyam', 'nine', 'The number nine.', 'Siyam ka tuig.|Nine years.', ''],
  ['napulo', 'ten', 'The number ten.', 'Napulo ka buok.|Ten pieces.', ''],
  ['napulog usa', 'eleven', 'Ten and one.', 'Napulog usa.|Eleven.', 'Teens are formed as "napulog" plus the digit.'],
  ['baynte', 'twenty', 'Twenty, from Spanish. Used far more than the native "kaluhaan".', 'Baynte pesos.|Twenty pesos.', ''],
  ['traynta', 'thirty', 'Thirty, from Spanish.', 'Traynta minutos.|Thirty minutes.', ''],
  ['singkwenta', 'fifty', 'Fifty, from Spanish.', 'Singkwenta ra.|Only fifty.', ''],
  ['gatos', 'hundred', 'One hundred.', 'Usa ka gatos.|One hundred.', ''],
  ['libo', 'thousand', 'One thousand.', 'Duha ka libo.|Two thousand.', ''],
  ['buok', 'piece / whole', 'A counter for individual items.', 'Lima ka buok.|Five pieces.', ''],
  ['tunga', 'half', 'One half.', 'Tunga sa oras.|Half an hour.', ''],
  ['una', 'first', 'Ordinal one, and also "ahead".', 'Ang una nga adlaw.|The first day.', ''],
  ['ikaduha', 'second', 'Ordinal two. Ordinals take "ika-".', 'Ikaduha nga higayon.|The second time.', ''],
  ['daghan', 'many / a lot', 'A large quantity.', 'Daghan kaayong salamat.|Very many thanks.', ''],
  ['tanan', 'all', 'The whole of a group.', 'Tanan kita.|All of us.', ''],
  ['pipila', 'a few / several', 'An unspecified small number.', 'Pipila ka adlaw.|A few days.', ''],
  ['walay', 'no / without', 'Expresses lacking something.', 'Walay tubig.|There is no water.', ''],
]},

/* ── Time ────────────────────────────────────────────────────── */
{ g: 'Time', tags: ['time', 'core'], w: [
  ['karon', 'now / today', 'The present moment, or the current day.', 'Karon na.|Right now.', ''],
  ['ugma', 'tomorrow', 'The next day.', 'Ugma ta magkita.|We will meet tomorrow.', ''],
  ['gahapon', 'yesterday', 'The previous day.', 'Gahapon pa.|Since yesterday.', ''],
  ['adlaw', 'day / sun', 'Both the day and the sun — one word for both.', 'Init ang adlaw.|The sun is hot.', ''],
  ['gabii', 'night', 'Night, and also "last night".', 'Gabii kaayo.|Very late at night.', ''],
  ['buntag', 'morning', 'The morning.', 'Sayo sa buntag.|Early in the morning.', ''],
  ['hapon', 'afternoon', 'The afternoon.', 'Hapon na.|It is afternoon already.', ''],
  ['udto', 'noon', 'Midday.', 'Udto na, mangaon ta.|It is noon, let us eat.', ''],
  ['semana', 'week', 'A week.', 'Sunod semana.|Next week.', ''],
  ['bulan', 'month / moon', 'Both the month and the moon.', 'Usa ka bulan.|One month.', ''],
  ['tuig', 'year', 'A year.', 'Bag-ong tuig.|New year.', ''],
  ['oras', 'hour / time', 'A clock hour, or time in general.', 'Unsa nga oras?|What time is it?', ''],
  ['minuto', 'minute', 'A minute.', 'Lima ka minuto.|Five minutes.', ''],
  ['sayo', 'early', 'Before the expected time.', 'Sayo ka.|You are early.', ''],
  ['ulahi', 'late / last', 'After the expected time, or final in a sequence.', 'Ulahi na ko.|I am late.', ''],
  ['kanunay', 'always', 'On every occasion.', 'Kanunay siyang ulahi.|He is always late.', ''],
  ['usahay', 'sometimes', 'On some occasions.', 'Usahay lang.|Only sometimes.', ''],
  ['kasagaran', 'usually', 'Most of the time.', 'Kasagaran sa buntag.|Usually in the morning.', ''],
  ['dili gyud', 'never', 'Not on any occasion.', 'Dili gyud ko mokaon niana.|I will never eat that.', ''],
  ['sunod', 'next / follow', 'The following one, and also to follow behind someone.', 'Sunod nga semana. / Sunod nako.|Next week. / Follow me.', ''],
  ['kagahapon', 'the other day', 'A recent past day, vaguer than "gahapon".', 'Kagahapon pa siya wala.|He has been away since the other day.', ''],
  ['karon dayon', 'right away', 'Immediately.', 'Karon dayon.|Right away.', ''],
  ['taudtaud', 'in a while', 'After a short interval.', 'Taudtaud ra.|In just a while.', ''],
  ['dugay', 'long (in time)', 'Taking a long time.', 'Dugay kaayo.|That took very long.', ''],
  ['Lunes', 'Monday', 'The first working day.', 'Lunes ta magsugod.|We start on Monday.', 'Days of the week are Spanish loans.'],
  ['Martes', 'Tuesday', 'The second day.', 'Martes ang exam.|The exam is on Tuesday.', ''],
  ['Miyerkules', 'Wednesday', 'The third day.', 'Miyerkules na.|It is Wednesday.', ''],
  ['Huwebes', 'Thursday', 'The fourth day.', 'Huwebes siya moabot.|He arrives Thursday.', ''],
  ['Biyernes', 'Friday', 'The fifth day.', 'Biyernes na gyud.|It is finally Friday.', ''],
  ['Sabado', 'Saturday', 'The sixth day.', 'Sabado ta molangoy.|We will swim on Saturday.', ''],
  ['Domingo', 'Sunday', 'The seventh day.', 'Domingo ang simba.|Church is on Sunday.', ''],
]},

/* ── People ──────────────────────────────────────────────────── */
{ g: 'Family and people', tags: ['family', 'people'], w: [
  ['tawo', 'person', 'A human being.', 'Daghang tawo.|Many people.', ''],
  ['bata', 'child', 'A child, or someone young.', 'Gamay pa nga bata.|Still a small child.', ''],
  ['lalaki', 'man / male', 'A male person.', 'Lalaki nga bata.|A boy.', ''],
  ['babaye', 'woman / female', 'A female person.', 'Babaye nga doktor.|A woman doctor.', ''],
  ['amahan', 'father', 'A father.', 'Akong amahan.|My father.', '"Papa" and "tatay" are the everyday address forms.'],
  ['inahan', 'mother', 'A mother.', 'Akong inahan.|My mother.', '"Mama" and "nanay" in direct address.'],
  ['anak', 'child (offspring)', 'One\'s son or daughter, at any age.', 'Duha akong anak.|I have two children.', 'Different from "bata", which is about age, not relationship.'],
  ['igsoon', 'sibling', 'A brother or sister — one word for both.', 'Akong igsoon.|My sibling.', 'Gender is added only if it matters: "igsoon nga lalaki".'],
  ['lolo', 'grandfather', 'A grandfather.', 'Si lolo natulog.|Grandfather is sleeping.', ''],
  ['lola', 'grandmother', 'A grandmother.', 'Si lola nagluto.|Grandmother is cooking.', ''],
  ['apo', 'grandchild', 'A grandchild.', 'Akong apo.|My grandchild.', ''],
  ['uyoan', 'uncle', 'An uncle.', 'Akong uyoan.|My uncle.', ''],
  ['iyaan', 'aunt', 'An aunt.', 'Akong iyaan.|My aunt.', ''],
  ['ig-agaw', 'cousin', 'A cousin.', 'Ig-agaw nako siya.|He is my cousin.', ''],
  ['asawa', 'wife', 'A wife.', 'Akong asawa.|My wife.', ''],
  ['bana', 'husband', 'A husband.', 'Iyang bana.|Her husband.', ''],
  ['pamilya', 'family', 'A family.', 'Dako among pamilya.|Our family is large.', ''],
  ['higala', 'friend', 'A friend.', 'Suod nga higala.|A close friend.', ''],
  ['migo', 'friend / mate', 'A casual friend, used in address. "Miga" for a woman.', 'Kumusta, migo?|How are you, mate?', ''],
  ['silingan', 'neighbour', 'Someone living nearby.', 'Among silingan.|Our neighbour.', ''],
  ['bisita', 'guest / visitor', 'Someone visiting.', 'Naay bisita.|There is a guest.', ''],
  ['Dong', '(address: young man)', 'Used to address a boy or younger man. There is no English equivalent.', 'Dong, palihug.|Lad, please.', 'Short for "dodong". Friendly, not rude.'],
  ['Day', '(address: young woman)', 'Used to address a girl or younger woman.', 'Day, pila ni?|Miss, how much is this?', 'Short for "inday".'],
  ['Nong', '(address: older man)', 'Respectful address for an older man.', 'Salamat, Nong.|Thank you, sir.', ''],
  ['Nang', '(address: older woman)', 'Respectful address for an older woman.', 'Nang, palihug.|Ma\'am, please.', ''],
  ['magtutudlo', 'teacher', 'Someone who teaches.', 'Magtutudlo siya.|She is a teacher.', ''],
  ['estudyante', 'student', 'Someone studying.', 'Estudyante pa ko.|I am still a student.', ''],
  ['doktor', 'doctor', 'A physician.', 'Adto sa doktor.|Go to the doctor.', ''],
  ['tindera', 'vendor / shopkeeper', 'A woman who sells. "Tindero" for a man.', 'Pangutan-a ang tindera.|Ask the vendor.', ''],
  ['drayber', 'driver', 'Someone who drives for a living.', 'Ang drayber sa jeep.|The jeepney driver.', ''],
  ['ngalan', 'name', 'A person\'s name.', 'Unsay imong ngalan?|What is your name?', ''],
]},

/* ── The verb system, which is the whole language ─────────────── */
{ g: 'Verb affixes', tags: ['verbs', 'grammar', 'core'], w: [
  ['mag-', '(will do / does)', 'Prefix marking an ongoing or habitual action with the doer as the focus. The workhorse of Cebuano verbs.', 'Magluto ko.|I will cook.', 'Cebuano marks WHO or WHAT the sentence is about by changing the verb, not the word order. This is the hardest and most important thing to learn.'],
  ['mi-', '(did)', 'Prefix marking a completed action, doer in focus.', 'Mikaon ko.|I ate.', 'Also appears as "ni-" — the same thing, different region.'],
  ['ni-', '(did)', 'The commoner spoken form of "mi-".', 'Niadto ko didto.|I went there.', ''],
  ['mo-', '(will do)', 'Prefix for a future or intended action, doer in focus.', 'Moadto ko ugma.|I will go tomorrow.', ''],
  ['nag-', '(is doing)', 'Prefix for an action in progress.', 'Nagluto siya.|She is cooking.', ''],
  ['naka-', '(was able to)', 'Marks ability or an accidental completed action.', 'Nakakaon na ko.|I have already eaten.', ''],
  ['maka-', '(can)', 'Marks ability in the future.', 'Makaadto ko ugma.|I can go tomorrow.', ''],
  ['-on', '(object focus)', 'Suffix putting the THING acted on in focus.', 'Kan-on nako ni.|I will eat this.', 'Choosing between "mag-" and "-on" is a choice about what the sentence is about, not about tense.'],
  ['-an', '(location focus)', 'Suffix putting the place or recipient in focus.', 'Hatagan nako siya.|I will give him some.', ''],
  ['i-', '(instrument focus)', 'Prefix putting the thing given or used in focus.', 'Ihatag nako ni.|I will give this.', ''],
  ['gi-', '(was done)', 'Marks a completed action with the object in focus — the commonest past form you will hear.', 'Gikaon nako.|I ate it.', ''],
  ['pag-', '(the act of)', 'Turns a verb into a noun, and forms commands.', 'Pagkaon.|Eating. / Eat.', ''],
  ['ma-', '(will become)', 'Marks a change of state.', 'Malipay ko.|I will be happy.', ''],
]},

{ g: 'Everyday verbs', tags: ['verbs', 'core'], w: [
  ['kaon', 'eat / come and eat', 'To take food. Called out to anyone passing while you are eating, it is an invitation and a courtesy rather than a literal offer.', 'Mangaon ta. / Kaon ta!|Let us eat. / Come eat with us!', 'Declining outright is rude; "salamat, busog pa ko" is the polite refusal.'],
  ['inom', 'drink / drinking session', 'To take liquid. As a noun it is a drinking gathering, which is a social institution rather than just an event.', 'Moinom ko ug tubig. / Naay inom karong gabii.|I will drink water. / There is a drinking session tonight.', ''],
  ['tulog', 'sleep', 'To sleep.', 'Matulog na ko.|I am going to sleep.', ''],
  ['mata', 'wake up / eye', 'To wake, and also the eye.', 'Nimata ko sayo. / Dako siyag mata.|I woke up early. / He has big eyes.', 'The link is not accidental: opening the eyes is waking.'],
  ['lakaw', 'walk / go', 'To walk, or to leave.', 'Molakaw na ta.|Let us go now.', ''],
  ['dagan', 'run', 'To run.', 'Nagdagan ang bata.|The child is running.', ''],
  ['lingkod', 'sit', 'To sit down.', 'Lingkod sa.|Sit down first.', ''],
  ['tindog', 'stand', 'To stand up.', 'Tindog ka.|Stand up.', ''],
  ['sulti', 'say / speak', 'To say something.', 'Unsay imong gisulti?|What did you say?', ''],
  ['storya', 'talk / chat', 'To converse.', 'Mag-storya ta.|Let us talk.', ''],
  ['pangutana', 'ask', 'To ask a question.', 'Mangutana ko.|I will ask.', ''],
  ['tubag', 'answer', 'To reply.', 'Tubaga ko.|Answer me.', ''],
  ['tan-aw', 'look / watch', 'To look at or watch.', 'Tan-awa ni.|Look at this.', ''],
  ['paminaw', 'listen / feel', 'To listen, and also to feel or sense.', 'Paminaw sa ko.|Listen to me first.', ''],
  ['dungog', 'hear', 'To hear.', 'Wala ko kadungog.|I did not hear.', ''],
  ['hibalo', 'know', 'To know a fact.', 'Wala ko kahibalo.|I do not know.', 'Often "kabalo" in speech.'],
  ['sabot', 'understand / agree', 'To understand, and also to come to an agreement.', 'Nakasabot ka?|Did you understand?', ''],
  ['hinumdom', 'remember', 'To remember.', 'Nahinumdom ko.|I remember.', ''],
  ['kalimot', 'forget', 'To forget.', 'Nakalimot ko.|I forgot.', ''],
  ['buhat', 'do / make', 'To do or make something.', 'Unsay imong gibuhat?|What are you doing?', ''],
  ['trabaho', 'work', 'To work, and also a job.', 'Nagtrabaho ko.|I am working.', ''],
  ['tuon', 'study', 'To study.', 'Nagtuon ko.|I am studying.', ''],
  ['basa', 'read / wet', 'To read, and quite separately, wet.', 'Nagbasa ko ug libro. / Basa ang sinina.|I am reading a book. / The clothes are wet.', 'Stress differs in speech, but they are written the same.'],
  ['sulat', 'write', 'To write, and also a letter.', 'Nagsulat ko.|I am writing.', ''],
  ['palit', 'buy', 'To buy.', 'Mopalit ko ug pan.|I will buy bread.', ''],
  ['baligya', 'sell', 'To sell.', 'Gibaligya nila.|They sold it.', ''],
  ['bayad', 'pay / payment', 'To pay, and the payment itself. Said alone when handing fare to a jeepney driver.', 'Magbayad ko. / Bayad ko.|I will pay. / Here is my fare.', '"Bayad ko" with the money held out is the whole transaction on a jeepney.'],
  ['hatag', 'give', 'To give.', 'Ihatag nako nimo.|I will give it to you.', ''],
  ['kuha', 'get / take', 'To take or fetch.', 'Kuhaa ni.|Take this.', ''],
  ['dala', 'bring / carry', 'To bring or carry.', 'Dad-a ni.|Bring this.', ''],
  ['butang', 'put / thing', 'To put, and also a thing.', 'Ibutang diha.|Put it there.', ''],
  ['abli', 'open', 'To open.', 'Ablihi ang pultahan.|Open the door.', ''],
  ['sirado', 'close / closed', 'To close, or shut.', 'Sirad-i ang bintana.|Close the window.', ''],
  ['luto', 'cook', 'To cook.', 'Nagluto si mama.|Mother is cooking.', ''],
  ['hugas', 'wash (dishes)', 'To wash things.', 'Maghugas ko sa plato.|I will wash the dishes.', ''],
  ['laba', 'wash (clothes)', 'To launder.', 'Naglaba siya.|She is doing laundry.', 'Cebuano splits washing dishes from washing clothes.'],
  ['ligo', 'bathe', 'To bathe or shower.', 'Maligo sa ko.|I will take a bath first.', ''],
  ['limpyo', 'clean', 'To clean, or clean as a state.', 'Limpyohi ang lamesa.|Clean the table.', ''],
  ['tabang', 'help', 'To help.', 'Tabangi ko.|Help me.', ''],
  ['hulat', 'wait', 'To wait.', 'Hulat sa.|Wait a moment.', ''],
  ['abot', 'arrive', 'To arrive.', 'Niabot na siya.|He has arrived.', ''],
  ['gikan', 'come from', 'To come from a place.', 'Gikan ko sa merkado.|I came from the market.', ''],
  ['balik', 'return', 'To go back or come back.', 'Mobalik ko ugma.|I will come back tomorrow.', ''],
  ['sulod', 'enter / inside', 'To go in, and also the inside.', 'Sulod sa.|Come in.', ''],
  ['gawas', 'go out / outside', 'To go out, and also the outside.', 'Gawas sa ko.|I will step out.', ''],
  ['saka', 'go up / climb', 'To ascend.', 'Saka sa balay.|Go up into the house.', ''],
  ['kanaog', 'go down / get off', 'To descend, and to alight from a vehicle.', 'Kanaog na. / Kanaog ko diri.|Come down now. / I will get off here.', ''],
  ['sakay', 'ride / board', 'To get on a vehicle, and to travel on it.', 'Mosakay ta ug jeep. / Sakay na.|Let us ride a jeepney. / Get on.', ''],
  ['gusto', 'want / like', 'To want or to like.', 'Gusto ko ana.|I want that.', ''],
  ['ganahan', 'like / be fond of', 'To enjoy or be fond of.', 'Ganahan ko nimo.|I like you.', 'Warmer than "gusto".'],
  ['kinahanglan', 'need / must', 'Necessity.', 'Kinahanglan ko motrabaho.|I need to work.', ''],
  ['mahimo', 'can / may', 'Possibility or permission.', 'Mahimo ba?|May I?', ''],
  ['puyo', 'live / reside', 'To live somewhere.', 'Asa ka nagpuyo?|Where do you live?', ''],
  ['hilak', 'cry', 'To weep.', 'Naghilak ang bata.|The child is crying.', ''],
  ['katawa', 'laugh', 'To laugh.', 'Nagkatawa sila.|They are laughing.', ''],
  ['dula', 'play', 'To play.', 'Magdula ta.|Let us play.', ''],
  ['kanta', 'sing / song', 'To sing, and also a song.', 'Kanta sa.|Sing for us.', ''],
  ['sayaw', 'dance', 'To dance.', 'Mosayaw ta.|Let us dance.', ''],
  ['hulam', 'borrow', 'To borrow.', 'Manghulam ko.|I will borrow.', ''],
  ['uli', 'go home', 'To return home.', 'Mouli na ko.|I am going home.', ''],
  ['pahulay', 'rest', 'To rest.', 'Pahulay sa.|Rest a while.', ''],
  ['pangita', 'look for', 'To search for.', 'Nangita ko nimo.|I was looking for you.', ''],
  ['kaplag', 'find', 'To find.', 'Nakaplagan nako.|I found it.', ''],
]},

/* ── Describing things ───────────────────────────────────────── */
{ g: 'Adjectives', tags: ['adjectives', 'core'], w: [
  ['maayo', 'good / well', 'Good, or in good condition.', 'Maayo ni.|This is good.', ''],
  ['dautan', 'bad / evil', 'Morally bad.', 'Dautan nga binuhatan.|A bad deed.', 'For "bad quality" use "dili maayo".'],
  ['dako', 'big', 'Large in size.', 'Dako nga isda.|A big fish.', ''],
  ['gamay', 'small / few', 'Small in size, and also small in quantity — Cebuano uses one word where English splits "small" from "few".', 'Gamay ra ni. / Gamay ra ang tawo.|This is only small. / There are only a few people.', ''],
  ['taas', 'tall / long', 'Tall, or long.', 'Taas siya.|He is tall.', ''],
  ['mubo', 'short', 'Short in height or length.', 'Mubo nga buhok.|Short hair.', ''],
  ['bag-o', 'new', 'Recently made or acquired.', 'Bag-o ni.|This is new.', ''],
  ['daan', 'old (thing)', 'Not new.', 'Daan nga balay.|An old house.', 'For people use "tigulang".'],
  ['tigulang', 'old (person)', 'Aged.', 'Tigulang na siya.|He is old now.', ''],
  ['batan-on', 'young', 'Young in years.', 'Batan-on pa siya.|She is still young.', ''],
  ['init', 'hot', 'High in temperature.', 'Init kaayo karon.|It is very hot today.', ''],
  ['bugnaw', 'cold', 'Low in temperature.', 'Bugnaw ang tubig.|The water is cold.', ''],
  ['lami', 'delicious', 'Tasting good.', 'Lami kaayo!|Very delicious!', 'The word you will use most at a table.'],
  ['tam-is', 'sweet', 'Sweet in taste.', 'Tam-is ang mangga.|The mango is sweet.', ''],
  ['aslom', 'sour', 'Sour in taste.', 'Aslom kaayo.|Very sour.', ''],
  ['parat', 'salty', 'Salty.', 'Parat ang sabaw.|The soup is salty.', ''],
  ['halang', 'spicy', 'Hot with chilli.', 'Halang kaayo!|Very spicy!', ''],
  ['pait', 'bitter', 'Bitter in taste, and also of a hard life.', 'Pait ang kape.|The coffee is bitter.', ''],
  ['nindot', 'beautiful / nice', 'Pleasing to look at.', 'Nindot kaayo.|Very beautiful.', ''],
  ['guapa', 'pretty', 'Of a woman, good-looking. "Guapo" for a man.', 'Guapa siya.|She is pretty.', 'From Spanish.'],
  ['hugaw', 'dirty', 'Not clean.', 'Hugaw ang dalan.|The road is dirty.', ''],
  ['hinlo', 'clean', 'Clean.', 'Hinlo ang kwarto.|The room is clean.', ''],
  ['kusog', 'strong / fast / loud', 'Strong, and also fast or loud.', 'Kusog ang ulan.|The rain is heavy.', 'One word covers force, speed and volume.'],
  ['hinay', 'slow / soft', 'Slow, and also quiet.', 'Hinay lang.|Slowly, now.', ''],
  ['lisod', 'difficult', 'Hard to do.', 'Lisod kaayo.|Very difficult.', ''],
  ['sayon', 'easy', 'Not hard.', 'Sayon ra.|It is easy.', ''],
  ['mahal', 'expensive / dear', 'Costly, and also beloved.', 'Mahal kaayo.|Very expensive.', ''],
  ['barato', 'cheap', 'Low in price.', 'Barato ra.|It is cheap.', ''],
  ['busog', 'full (from food)', 'Having eaten enough.', 'Busog na ko.|I am full.', ''],
  ['gutom', 'hungry', 'Needing food.', 'Gutom ko.|I am hungry.', ''],
  ['uhaw', 'thirsty', 'Needing drink.', 'Uhaw ko.|I am thirsty.', ''],
  ['kapoy', 'tired', 'Lacking energy. Also used as an exclamation of weariness.', 'Kapoy kaayo.|So tired.', ''],
  ['sakit', 'painful / sick', 'Hurting, and also an illness.', 'Sakit akong ulo.|My head hurts.', ''],
  ['layo', 'far', 'Distant.', 'Layo ra kaayo.|It is too far.', ''],
  ['duol', 'near', 'Close by.', 'Duol ra.|It is near.', ''],
  ['puno', 'full', 'Filled.', 'Puno ang jeep.|The jeepney is full.', ''],
  ['walay sulod', 'empty', 'Containing nothing.', 'Walay sulod.|It is empty.', ''],
  ['tinuod', 'true / real', 'Factual or genuine.', 'Tinuod ba?|Is it true?', ''],
  ['bakak', 'false / a lie', 'Untrue, and also a lie.', 'Bakak na.|That is a lie.', ''],
]},

/* ── Food ────────────────────────────────────────────────────── */
{ g: 'Food and drink', tags: ['food'], w: [
  ['pagkaon', 'food', 'Food in general.', 'Naay pagkaon.|There is food.', ''],
  ['kan-on', 'cooked rice', 'Rice that has been cooked. The centre of every meal.', 'Daghang kan-on.|A lot of rice.', 'Different word from uncooked rice — the distinction matters here.'],
  ['bugas', 'uncooked rice', 'Raw rice grain.', 'Mopalit ug bugas.|Buy some rice.', ''],
  ['humay', 'rice plant', 'Rice growing in the field.', 'Uma sa humay.|A rice field.', ''],
  ['tubig', 'water', 'Water.', 'Palihug ug tubig.|Water, please.', ''],
  ['kape', 'coffee / brown', 'Coffee, and by extension the colour brown.', 'Mag-kape ta. / Kape nga kolor.|Let us have coffee. / Brown in colour.', ''],
  ['gatas', 'milk', 'Milk.', 'Gatas sa baka.|Cow\'s milk.', ''],
  ['asukar', 'sugar', 'Sugar.', 'Walay asukar.|No sugar.', ''],
  ['asin', 'salt', 'Salt.', 'Kulang sa asin.|It needs salt.', ''],
  ['isda', 'fish', 'Fish.', 'Presko nga isda.|Fresh fish.', ''],
  ['karne', 'meat', 'Meat.', 'Karne sa baboy.|Pork.', ''],
  ['manok', 'chicken', 'Chicken, the bird and the meat.', 'Lutoa ang manok.|Cook the chicken.', ''],
  ['baboy', 'pig / pork', 'Pig, and pork.', 'Lechon baboy.|Roast pig.', ''],
  ['baka', 'cow / beef', 'Cow, and beef.', 'Karne sa baka.|Beef.', ''],
  ['itlog', 'egg', 'An egg.', 'Duha ka itlog.|Two eggs.', ''],
  ['utanon', 'vegetables', 'Vegetables.', 'Kaon ug utanon.|Eat vegetables.', ''],
  ['prutas', 'fruit', 'Fruit.', 'Tam-is nga prutas.|Sweet fruit.', ''],
  ['saging', 'banana', 'Banana.', 'Hinog nga saging.|A ripe banana.', ''],
  ['mangga', 'mango', 'Mango.', 'Lami ang mangga.|The mango is delicious.', ''],
  ['lubi', 'coconut', 'Coconut.', 'Tubig sa lubi.|Coconut water.', ''],
  ['kamote', 'sweet potato', 'Sweet potato.', 'Linat-ang kamote.|Boiled sweet potato.', ''],
  ['pan', 'bread', 'Bread.', 'Pan ug kape.|Bread and coffee.', ''],
  ['sabaw', 'soup / broth', 'Soup or broth.', 'Init nga sabaw.|Hot soup.', ''],
  ['sud-an', 'viand', 'The dish eaten with rice — a category English has no word for.', 'Unsay sud-an?|What is the viand?', 'Asking this is asking what is for dinner.'],
  ['merienda', 'snack', 'A between-meals snack, usually mid-afternoon.', 'Merienda ta.|Let us have a snack.', ''],
  ['pamahaw', 'breakfast', 'The morning meal.', 'Nagpamahaw na ko.|I have had breakfast.', ''],
  ['paniudto', 'lunch', 'The midday meal.', 'Paniudto ta.|Let us have lunch.', ''],
  ['panihapon', 'dinner', 'The evening meal.', 'Andam na ang panihapon.|Dinner is ready.', ''],
  ['plato', 'plate', 'A plate.', 'Kuhaa ang plato.|Get the plate.', ''],
  ['kutsara', 'spoon', 'A spoon.', 'Walay kutsara.|There is no spoon.', ''],
  ['tinidor', 'fork', 'A fork.', 'Kutsara ug tinidor.|Spoon and fork.', ''],
  ['baso', 'glass', 'A drinking glass.', 'Usa ka baso ug tubig.|A glass of water.', ''],
]},

/* ── Home and things ─────────────────────────────────────────── */
{ g: 'Home and objects', tags: ['home', 'objects'], w: [
  ['balay', 'house / home', 'A house or home.', 'Sa among balay.|At our house.', ''],
  ['kwarto', 'room', 'A room.', 'Akong kwarto.|My room.', ''],
  ['pultahan', 'door', 'A door.', 'Sirad-i ang pultahan.|Close the door.', ''],
  ['bintana', 'window', 'A window.', 'Abli ang bintana.|The window is open.', ''],
  ['lamesa', 'table', 'A table.', 'Ibutang sa lamesa.|Put it on the table.', ''],
  ['silya', 'chair', 'A chair.', 'Lingkod sa silya.|Sit on the chair.', ''],
  ['katre', 'bed', 'A bed.', 'Higda sa katre.|Lie on the bed.', ''],
  ['banyo', 'bathroom', 'A bathroom.', 'Asa ang banyo?|Where is the bathroom?', ''],
  ['kusina', 'kitchen', 'A kitchen.', 'Naa siya sa kusina.|She is in the kitchen.', ''],
  ['suga', 'light / lamp', 'A light.', 'Patya ang suga.|Turn off the light.', ''],
  ['tubig nga gripo', 'tap water', 'Running water from a tap.', 'Walay tubig sa gripo.|There is no tap water.', ''],
  ['sinina', 'clothes', 'Clothing.', 'Bag-ong sinina.|New clothes.', ''],
  ['sapatos', 'shoes', 'Shoes.', 'Itom nga sapatos.|Black shoes.', ''],
  ['kwarta', 'money', 'Money.', 'Walay kwarta.|No money.', ''],
  ['libro', 'book', 'A book.', 'Basaha ang libro.|Read the book.', ''],
  ['papel', 'paper', 'Paper.', 'Usa ka papel.|A piece of paper.', ''],
  ['bolpen', 'pen', 'A ballpoint pen.', 'Hulam ko sa bolpen.|Lend me the pen.', ''],
  ['telepono', 'phone', 'A telephone.', 'Tawag sa telepono.|Call on the phone.', ''],
  ['yawe', 'key', 'A key.', 'Hain ang yawe?|Where is the key?', ''],
  ['bag', 'bag', 'A bag.', 'Sa akong bag.|In my bag.', ''],
  ['relo', 'watch / clock', 'A watch or clock.', 'Tan-awa ang relo.|Look at the clock.', ''],
  ['bugon', 'pillow', 'A pillow.', 'Humok nga unlan.|A soft pillow.', 'More often "unlan".'],
  ['unlan', 'pillow', 'A pillow.', 'Kuhaa ang unlan.|Get the pillow.', ''],
  ['habol', 'blanket / blunt', 'A blanket. Also blunt, of a blade.', 'Kuhaa ang habol. / Habol ang kutsilyo.|Get the blanket. / The knife is blunt.', 'Unrelated senses sharing a spelling.'],
]},

/* ── Getting around ──────────────────────────────────────────── */
{ g: 'Places and travel', tags: ['places', 'travel'], w: [
  ['dalan', 'road / street', 'A road or the way to somewhere.', 'Unsang dalana?|Which road?', ''],
  ['merkado', 'market', 'A market.', 'Adto sa merkado.|Go to the market.', ''],
  ['tindahan', 'store', 'A shop.', 'Duol ra ang tindahan.|The store is near.', ''],
  ['eskwelahan', 'school', 'A school.', 'Adto sa eskwelahan.|Go to school.', ''],
  ['simbahan', 'church', 'A church.', 'Sa simbahan.|At the church.', ''],
  ['ospital', 'hospital', 'A hospital.', 'Dad-a sa ospital.|Take him to the hospital.', ''],
  ['syudad', 'city', 'A city.', 'Sa syudad sa Cebu.|In Cebu City.', ''],
  ['baryo', 'village', 'A village or rural neighbourhood.', 'Sa among baryo.|In our village.', ''],
  ['dagat', 'sea', 'The sea.', 'Adto ta sa dagat.|Let us go to the sea.', ''],
  ['bukid', 'mountain', 'A mountain.', 'Taas nga bukid.|A tall mountain.', ''],
  ['uma', 'farm / field', 'A farm or field.', 'Nagtrabaho sa uma.|Working in the field.', ''],
  ['suba', 'river', 'A river.', 'Naligo sa suba.|Bathed in the river.', ''],
  ['jeep', 'jeepney', 'The shared passenger jeep, the ordinary way to travel.', 'Sakay ta ug jeep.|Let us take a jeepney.', ''],
  ['habal-habal', 'motorbike taxi', 'A motorcycle used as transport for hire, common outside cities.', 'Habal-habal ra.|Just a motorbike taxi.', ''],
  ['traysikad', 'pedicab', 'A bicycle with a sidecar.', 'Traysikad lang ta.|Let us just take a pedicab.', ''],
  ['barko', 'ship', 'A ship.', 'Mosakay ug barko.|Travel by ship.', ''],
  ['ayroplano', 'airplane', 'An aeroplane.', 'Mosakay ug ayroplano.|Travel by plane.', ''],
  ['tabok', 'cross over', 'To cross a road or water.', 'Tabok ta.|Let us cross.', ''],
  ['diretso', 'straight ahead', 'Continue without turning.', 'Diretso lang.|Just go straight.', ''],
  ['tuo', 'right', 'The right-hand side.', 'Liko sa tuo.|Turn right.', ''],
  ['liko', 'turn', 'To turn a corner.', 'Liko diha.|Turn there.', ''],
  ['unahan', 'further on', 'Ahead of here.', 'Unahan pa.|A bit further on.', ''],
  ['likod', 'behind / back', 'Behind something, the back of a thing, and the back of the body.', 'Sa likod sa balay. / Sakit akong likod.|Behind the house. / My back hurts.', ''],
  ['atubangan', 'in front of', 'The front.', 'Sa atubangan.|In front.', ''],
  ['taliwala', 'in the middle', 'Between or among.', 'Sa taliwala.|In the middle.', ''],
  ['sulod sa', 'inside', 'Within something.', 'Sulod sa balay.|Inside the house.', ''],
  ['ibabaw', 'on top of', 'Above or on.', 'Ibabaw sa lamesa.|On the table.', ''],
  ['ilalom', 'under', 'Beneath.', 'Ilalom sa katre.|Under the bed.', ''],
]},

/* ── Feeling ─────────────────────────────────────────────────── */
{ g: 'Feelings', tags: ['feelings'], w: [
  ['malipayon', 'happy', 'In good spirits.', 'Malipayon ko.|I am happy.', ''],
  ['masulub-on', 'sad', 'In low spirits.', 'Masulub-on siya.|He is sad.', ''],
  ['nasuko', 'angry', 'Angry.', 'Nasuko siya nako.|He is angry with me.', ''],
  ['nahadlok', 'afraid', 'Frightened.', 'Nahadlok ko.|I am afraid.', ''],
  ['naulaw', 'embarrassed / shy', 'Ashamed or shy — a strong social feeling here.', 'Naulaw ko.|I am embarrassed.', 'Carries more weight than English "shy".'],
  ['nalipay', 'glad', 'Pleased at something.', 'Nalipay ko nga niabot ka.|I am glad you came.', ''],
  ['gimingaw', 'missing someone', 'To long for someone absent.', 'Gimingaw ko nimo.|I miss you.', ''],
  ['gikapoy', 'worn out', 'Exhausted.', 'Gikapoy ko.|I am worn out.', ''],
  ['nabalaka', 'worried', 'Anxious about something.', 'Nabalaka ko nimo.|I am worried about you.', ''],
  ['nalingaw', 'enjoying', 'Having a good time.', 'Nalingaw ko.|I am enjoying myself.', ''],
  ['gimahal', 'loved', 'To love someone.', 'Gimahal tika.|I love you.', ''],
  ['nahigugma', 'in love', 'To be in love.', 'Nahigugma ko nimo.|I am in love with you.', ''],
]},

/* ── The world outside ───────────────────────────────────────── */
{ g: 'Weather and nature', tags: ['weather', 'nature'], w: [
  ['ulan', 'rain', 'Rain.', 'Nag-ulan.|It is raining.', ''],
  ['hangin', 'wind / air', 'Wind, and also air.', 'Kusog ang hangin.|The wind is strong.', ''],
  ['panganod', 'cloud', 'A cloud.', 'Daghang panganod.|Many clouds.', ''],
  ['bagyo', 'typhoon / storm', 'A typhoon.', 'Naay bagyo.|There is a typhoon.', ''],
  ['kilat', 'lightning', 'Lightning.', 'Naay kilat.|There is lightning.', ''],
  ['dalugdog', 'thunder', 'Thunder.', 'Kusog ang dalugdog.|The thunder is loud.', ''],
  ['kahoy', 'tree / wood', 'A tree, and also wood.', 'Dako nga kahoy.|A big tree.', ''],
  ['bulak', 'flower', 'A flower.', 'Nindot nga bulak.|A beautiful flower.', ''],
  ['dahon', 'leaf', 'A leaf.', 'Berde nga dahon.|A green leaf.', ''],
  ['balas', 'sand', 'Sand.', 'Puti nga balas.|White sand.', ''],
  ['bato', 'stone / rock', 'A stone.', 'Dako nga bato.|A big rock.', ''],
  ['yuta', 'land / soil', 'Land or earth.', 'Among yuta.|Our land.', ''],
  ['kalayo', 'fire', 'Fire.', 'Pataya ang kalayo.|Put out the fire.', ''],
  ['bituon', 'star', 'A star.', 'Daghang bituon.|Many stars.', ''],
  ['langit', 'sky / heaven', 'The sky, and also heaven.', 'Tin-aw ang langit.|The sky is clear.', ''],
]},

{ g: 'Animals', tags: ['animals'], w: [
  ['iro', 'dog', 'A dog.', 'Ang iro nag-uwang.|The dog is barking.', ''],
  ['iring', 'cat', 'A cat.', 'Ang iring natulog.|The cat is sleeping.', ''],
  ['kabaw', 'water buffalo', 'The carabao, the working animal of the farm.', 'Ang kabaw sa uma.|The carabao in the field.', ''],
  ['kanding', 'goat', 'A goat.', 'Duha ka kanding.|Two goats.', ''],
  ['langgam', 'bird', 'A bird.', 'Naglupad ang langgam.|The bird is flying.', ''],
  ['bakbak', 'frog', 'A frog.', 'Naay bakbak.|There is a frog.', ''],
  ['halas', 'snake', 'A snake.', 'Hadlok ko sa halas.|I am afraid of snakes.', ''],
  ['lamok', 'mosquito', 'A mosquito.', 'Daghang lamok.|Many mosquitoes.', ''],
]},

{ g: 'Colours', tags: ['colours'], w: [
  ['puti', 'white', 'The colour white.', 'Puti nga sinina.|A white shirt.', ''],
  ['itom', 'black', 'The colour black.', 'Itom nga buhok.|Black hair.', ''],
  ['pula', 'red', 'The colour red.', 'Pula nga bulak.|A red flower.', ''],
  ['berde', 'green', 'The colour green.', 'Berde nga dahon.|A green leaf.', ''],
  ['asul', 'blue', 'The colour blue.', 'Asul nga langit.|A blue sky.', ''],
  ['dalag', 'yellow', 'The colour yellow.', 'Dalag nga saging.|A yellow banana.', ''],
  ['abuhon', 'grey', 'The colour grey.', 'Abuhon nga panganod.|A grey cloud.', ''],
]},

/* ── The body ────────────────────────────────────────────────── */
{ g: 'Body', tags: ['body'], w: [
  ['ulo', 'head', 'The head.', 'Sakit akong ulo.|My head hurts.', ''],
  ['ilong', 'nose', 'The nose.', 'Tubig sa ilong.|A runny nose.', ''],
  ['baba', 'mouth', 'The mouth.', 'Abli ang baba.|Open your mouth.', ''],
  ['dalunggan', 'ear', 'The ear.', 'Sakit akong dalunggan.|My ear hurts.', ''],
  ['kamot', 'hand', 'The hand.', 'Hugasi imong kamot.|Wash your hands.', ''],
  ['tiil', 'foot / leg', 'The foot and leg together.', 'Sakit akong tiil.|My foot hurts.', ''],
  ['tiyan', 'stomach', 'The belly.', 'Sakit akong tiyan.|My stomach hurts.', ''],
  ['buhok', 'hair', 'Hair on the head.', 'Taas iyang buhok.|Her hair is long.', ''],
  ['ngipon', 'tooth', 'A tooth.', 'Sakit akong ngipon.|My tooth hurts.', ''],
  ['dugo', 'blood', 'Blood.', 'Naay dugo.|There is blood.', ''],
  ['kasingkasing', 'heart', 'The heart.', 'Akong kasingkasing.|My heart.', ''],
]},

/* ── Money and buying ────────────────────────────────────────── */
{ g: 'Money and shopping', tags: ['money', 'shopping'], w: [
  ['piso', 'peso', 'The unit of currency.', 'Lima ka piso.|Five pesos.', ''],
  ['sinsilyo', 'coins / change', 'Small change.', 'Walay sinsilyo.|No change.', ''],
  ['presyo', 'price', 'The price of something.', 'Pila ang presyo?|What is the price?', ''],
  ['hangyo', 'bargain / plead', 'To ask for a lower price, or to plead.', 'Mahangyo ba?|Can the price come down?', 'Bargaining at a market is normal and expected.'],
  ['barato ra', 'that is cheap', 'A judgement that something is inexpensive.', 'Barato ra kaayo.|That is very cheap.', ''],
  ['mahal ra', 'that is too dear', 'A judgement that something costs too much.', 'Mahal ra kaayo.|That is far too expensive.', 'The standard opening move when bargaining.'],
  ['utang', 'debt / credit', 'Money owed, and also buying on credit.', 'Utang sa tindahan.|Credit at the store.', ''],
  ['sukli', 'change (money back)', 'The change returned.', 'Asa ang sukli?|Where is the change?', ''],
  ['libre', 'free', 'At no cost.', 'Libre ni.|This is free.', ''],
  ['kulang', 'lacking / short', 'Not enough.', 'Kulang ang bayad.|The payment is short.', ''],
  ['sobra', 'excess / too much', 'More than needed.', 'Sobra ni.|This is too much.', ''],
]},

/* ── Whole things you can say ────────────────────────────────── */
{ g: 'Everyday phrases', tags: ['phrases', 'essentials'], w: [
  ['unsay imong ngalan', 'what is your name', 'The standard way to ask a name.', 'Unsay imong ngalan?|What is your name?', ''],
  ['ako si', 'I am', 'Introduces yourself by name.', 'Ako si Maria.|I am Maria.', '"Si" marks a personal name and is not optional.'],
  ['taga-asa ka', 'where are you from', 'Asks someone\'s origin.', 'Taga-asa ka?|Where are you from?', '"Taga-" means "from" with a place.'],
  ['taga-Cebu ko', 'I am from Cebu', 'States your origin.', 'Taga-Cebu ko.|I am from Cebu.', ''],
  ['wala ko kasabot', 'I do not understand', 'Say this early and often.', 'Pasaylo-a, wala ko kasabot.|Sorry, I do not understand.', 'The single most useful sentence for a learner.'],
  ['hinay-hinay palihug', 'slowly please', 'Asks someone to slow down.', 'Hinay-hinay palihug.|Slowly, please.', ''],
  ['balika palihug', 'please repeat', 'Asks for something to be said again.', 'Balika palihug.|Please say it again.', ''],
  ['unsa may Cebuano sa', 'what is the Cebuano for', 'Asks for a translation.', 'Unsa may Cebuano sa "window"?|What is the Cebuano for "window"?', 'The question that grows your vocabulary fastest.'],
  ['unsay pasabot ani', 'what does this mean', 'Asks for a meaning.', 'Unsay pasabot ani?|What does this mean?', ''],
  ['makasulti ka ug English', 'do you speak English', 'Asks about language.', 'Makasulti ka ug English?|Do you speak English?', ''],
  ['gamay ra akong Bisaya', 'my Bisaya is only little', 'Sets expectations politely.', 'Gamay ra akong Bisaya.|I only speak a little Bisaya.', 'Usually met with encouragement rather than impatience.'],
  ['asa ang banyo', 'where is the bathroom', 'A necessary question.', 'Asa ang banyo?|Where is the bathroom?', ''],
  ['pila ni', 'how much is this', 'Asks a price.', 'Pila ni, Nang?|How much is this, ma\'am?', ''],
  ['mahangyo ba', 'can the price come down', 'Opens a bargain.', 'Mahangyo ba ni?|Can this come down a bit?', 'Normal at a market, not rude.'],
  ['kuhaon nako ni', 'I will take this', 'Closes a purchase.', 'Kuhaon nako ni.|I will take this.', ''],
  ['walay problema', 'no problem', 'Reassurance.', 'Walay problema.|No problem.', ''],
  ['ayaw kabalaka', 'do not worry', 'Reassurance to someone anxious.', 'Ayaw kabalaka.|Do not worry.', ''],
  ['maayo na lang', 'it is fine / just as well', 'Accepts a situation.', 'Maayo na lang.|It is fine as it is.', ''],
  ['sige lang', 'never mind / go ahead', 'Waves something off.', 'Sige lang, ako na.|Never mind, I will do it.', ''],
  ['unsa na', 'what now / what is it', 'Asks what is happening.', 'Unsa na?|What is it?', ''],
  ['naa ba', 'is there any', 'Asks whether something is available.', 'Naa bay tubig?|Is there any water?', ''],
  ['naa koy', 'I have', 'States possession.', 'Naa koy igsoon.|I have a sibling.', ''],
  ['wala koy', 'I do not have', 'States lack.', 'Wala koy kwarta.|I have no money.', ''],
  ['gikapoy ko', 'I am tired', 'States a state.', 'Gikapoy ko karon.|I am tired now.', ''],
  ['maayo ra ko', 'I am alright', 'Reassures about yourself.', 'Maayo ra ko, salamat.|I am alright, thanks.', ''],
  ['unsaon nako pag-adto', 'how do I get there', 'Asks for directions.', 'Unsaon nako pag-adto sa merkado?|How do I get to the market?', ''],
  ['layo pa ba', 'is it still far', 'Asks about distance remaining.', 'Layo pa ba?|Is it still far?', ''],
  ['hulat sa', 'wait a moment', 'Asks for a pause.', 'Hulat sa gamay.|Wait just a moment.', ''],
  ['dali ra', 'it is quick / come here', 'Says something is fast; "dali" alone calls someone over.', 'Dali ra ni.|This is quick.', ''],
  ['ayaw na', 'stop / no more', 'Asks someone to stop.', 'Ayaw na, palihug.|Stop, please.', ''],
  ['salamat sa tabang', 'thanks for the help', 'Specific thanks.', 'Salamat sa tabang.|Thank you for the help.', ''],
  ['maayong adlaw', 'good day', 'A general greeting for any time.', 'Maayong adlaw kanimo.|Good day to you.', ''],
  ['kita ta unya', 'see you later', 'A parting.', 'Kita ta unya.|See you later.', ''],
  ['pag-amping', 'be careful', 'Said on parting, or as a warning.', 'Pag-amping sa dalan.|Be careful on the road.', ''],
]},

/* ── Work and school ─────────────────────────────────────────── */
{ g: 'Work and school', tags: ['work', 'school'], w: [
  ['trabahante', 'worker', 'Someone who works.', 'Trabahante siya sa pabrika.|He is a worker at the factory.', ''],
  ['opisina', 'office', 'An office.', 'Adto ko sa opisina.|I am going to the office.', ''],
  ['suweldo', 'salary / wages', 'Pay for work.', 'Gamay ang suweldo.|The pay is small.', ''],
  ['boss', 'boss', 'The person in charge. Borrowed and universal.', 'Ang among boss.|Our boss.', ''],
  ['klase', 'class', 'A school class, or a kind of thing.', 'Naa koy klase karon.|I have class today.', ''],
  ['leksyon', 'lesson', 'A lesson.', 'Lisod ang leksyon.|The lesson is hard.', ''],
  ['eksamen', 'exam', 'A test.', 'Naa miy eksamen ugma.|We have an exam tomorrow.', ''],
  ['grado', 'grade / mark', 'A school mark.', 'Maayo akong grado.|My grades are good.', ''],
  ['nakapasar', 'passed', 'Succeeded in a test.', 'Nakapasar ko.|I passed.', ''],
  ['nahagbong', 'failed', 'Did not pass.', 'Nahagbong ko sa math.|I failed maths.', ''],
  ['assignment', 'homework', 'Work to do at home. Borrowed.', 'Daghan kog assignment.|I have a lot of homework.', ''],
  ['tudlo', 'teach / point', 'To teach, and also to point at.', 'Tudloi ko.|Teach me.', ''],
  ['kat-on', 'learn', 'To learn.', 'Gusto ko makakat-on.|I want to learn.', ''],
  ['praktis', 'practice', 'To practise.', 'Kinahanglan ug praktis.|It needs practice.', ''],
  ['sayop', 'mistake / wrong', 'An error, or being wrong.', 'Sayop ni.|This is wrong.', ''],
  ['tama', 'correct / right', 'Correct.', 'Tama ka.|You are right.', ''],
  ['sulayi', 'try it', 'To attempt something.', 'Sulayi sa.|Give it a try.', ''],
  ['husto', 'enough / correct', 'Sufficient, and also correct.', 'Husto na.|That is enough.', ''],
  ['andam', 'ready / prepare', 'Ready, or to prepare.', 'Andam na ko.|I am ready.', ''],
  ['human', 'finished / after', 'Done, and also "after".', 'Human na.|It is finished.', ''],
  ['sugod', 'start', 'To begin.', 'Magsugod ta.|Let us start.', ''],
  ['undang', 'stop / quit', 'To cease.', 'Undang sa.|Stop for now.', ''],
  ['padayon', 'continue', 'To carry on.', 'Padayon lang.|Just carry on.', ''],
  ['kompyuter', 'computer', 'A computer.', 'Naa koy kompyuter.|I have a computer.', ''],
  ['sulatanan', 'notebook', 'A writing book.', 'Abliha ang sulatanan.|Open the notebook.', ''],
]},

/* ── Health ──────────────────────────────────────────────────── */
{ g: 'Health', tags: ['health', 'body'], w: [
  ['masakiton', 'sick / ill', 'Being unwell.', 'Masakiton siya.|He is sick.', ''],
  ['hilanat', 'fever', 'A fever.', 'Naay hilanat ang bata.|The child has a fever.', ''],
  ['ubo', 'cough', 'A cough.', 'Naa koy ubo.|I have a cough.', ''],
  ['sip-on', 'cold / runny nose', 'A head cold.', 'Naa koy sip-on.|I have a cold.', ''],
  ['labad', 'headache / dizzy', 'A headache or dizziness.', 'Labad akong ulo.|My head aches.', ''],
  ['suka', 'vomit / vinegar', 'To be sick. Also, and unrelatedly, vinegar -- which is on every Visayan table.', 'Nagsuka siya. / Butangi ug suka.|He vomited. / Add some vinegar.', 'Two unrelated words with one spelling. Context always separates them.'],
  ['samad', 'wound / cut', 'An injury to the skin.', 'Naay samad akong tiil.|There is a cut on my foot.', ''],
  ['tambal', 'medicine / treat', 'Medicine, and to treat.', 'Inom ug tambal.|Take medicine.', ''],
  ['bulong', 'remedy', 'A cure or remedy.', 'Walay bulong.|There is no cure.', ''],
  ['nars', 'nurse', 'A nurse.', 'Ang nars sa ospital.|The nurse at the hospital.', ''],
  ['maayo na', 'better now', 'Recovered or improving.', 'Maayo na ko.|I am better now.', ''],
  ['pahuway', 'rest', 'To rest, especially when ill.', 'Kinahanglan nimo ug pahuway.|You need rest.', ''],
  ['ginhawa', 'breath / breathe', 'Breath, and to breathe.', 'Lawom nga ginhawa.|A deep breath.', ''],
  ['bug-at', 'heavy', 'Heavy, and also of a heavy feeling.', 'Bug-at kaayo.|Very heavy.', ''],
  ['gaan', 'light (weight)', 'Not heavy.', 'Gaan ra ni.|This is light.', ''],
]},

/* ── Clothes ─────────────────────────────────────────────────── */
{ g: 'Clothing', tags: ['clothing', 'objects'], w: [
  ['sanina', 'shirt / clothes', 'A shirt or clothing generally.', 'Bag-ong sanina.|A new shirt.', 'Also spelled "sinina".'],
  ['karsones', 'trousers', 'Trousers.', 'Itom nga karsones.|Black trousers.', ''],
  ['tsinelas', 'slippers', 'Flip-flops — the everyday footwear.', 'Tsinelas ra.|Just slippers.', ''],
  ['kalo', 'hat', 'A hat.', 'Isul-ob ang kalo.|Put on the hat.', ''],
  ['sul-ob', 'wear', 'To put on or wear.', 'Unsay imong gisul-ob?|What are you wearing?', ''],
  ['huboa', 'take off', 'To remove clothing.', 'Huboa ang sapatos.|Take off the shoes.', ''],
  ['bisti', 'dress / garment', 'A dress or garment.', 'Nindot nga bisti.|A beautiful dress.', ''],
  ['medyas', 'socks', 'Socks.', 'Walay medyas.|No socks.', ''],
  ['pantalon', 'pants', 'Trousers, another common word.', 'Asul nga pantalon.|Blue trousers.', ''],
]},

/* ── Social life ─────────────────────────────────────────────── */
{ g: 'Social', tags: ['social', 'culture'], w: [
  ['pista', 'fiesta / feast', 'The town festival — a central event in Visayan life.', 'Pista sa among lungsod.|Our town fiesta.', 'Visitors are fed whether or not they are invited; refusing food is the rude part.'],
  ['kasal', 'wedding', 'A wedding.', 'Adto ko sa kasal.|I am going to a wedding.', ''],
  ['binyag', 'baptism', 'A christening.', 'Binyag sa bata.|The child\'s baptism.', ''],
  ['lubong', 'funeral / burial', 'A burial.', 'Naay lubong ugma.|There is a funeral tomorrow.', ''],
  ['handa', 'feast / prepared food', 'Food laid on for an occasion.', 'Daghang handa.|There is a lot of food.', ''],
  ['tambay', 'hang around', 'To loiter or hang out, with no particular purpose.', 'Nagtambay ra mi.|We are just hanging around.', ''],
  ['barkada', 'friend group', 'One\'s circle of friends — a stronger idea than English "mates".', 'Akong barkada.|My group of friends.', ''],
  ['istorya', 'story / talk', 'A story, and also to converse.', 'Taas nga istorya.|A long story.', ''],
  ['chismis', 'gossip', 'Gossip.', 'Puros chismis.|Nothing but gossip.', ''],
  ['tabi', 'gossip / chat', 'Idle talk about others.', 'Ayaw pagtabi.|Do not gossip.', ''],
  ['simba', 'attend church', 'To go to mass.', 'Magsimba ta ugma.|Let us go to church tomorrow.', ''],
  ['ampo', 'pray / prayer', 'To pray.', 'Mag-ampo ta.|Let us pray.', ''],
  ['Ginoo', 'God / Lord', 'God.', 'Salamat sa Ginoo.|Thanks be to God.', ''],
  ['grasya', 'blessing / grace', 'A blessing.', 'Grasya gikan sa Ginoo.|A blessing from God.', ''],
  ['bulahan', 'blessed / fortunate', 'Fortunate.', 'Bulahan ka.|You are fortunate.', ''],
  ['pasalamat', 'give thanks', 'To express gratitude.', 'Magpasalamat ta.|Let us give thanks.', ''],
  ['bayanihan', 'communal help', 'Neighbours working together for one household, unpaid.', 'Bayanihan sa baryo.|Communal help in the village.', 'A cultural idea with no English word.'],
  ['hatag ug respeto', 'show respect', 'To treat with respect.', 'Hatag ug respeto sa tigulang.|Show respect to elders.', ''],
  ['pagtahod', 'respect', 'Respect, especially for elders.', 'Pagtahod sa ginikanan.|Respect for parents.', ''],
  ['ginikanan', 'parents', 'One\'s parents.', 'Akong ginikanan.|My parents.', ''],
]},

/* ── More of the verbs you need daily ────────────────────────── */
{ g: 'More verbs', tags: ['verbs'], w: [
  ['higda', 'lie down', 'To lie down.', 'Higda sa katre.|Lie on the bed.', ''],
  ['bangon', 'get up', 'To rise from lying.', 'Bangon na.|Get up now.', ''],
  ['pahulam', 'lend', 'To give temporarily.', 'Pahulama ko.|Lend it to me.', ''],
  ['takup', 'shut', 'To close or cover.', 'Takupi ang kaldero.|Cover the pot.', ''],
  ['punit', 'pick up', 'To pick something off the ground.', 'Punita.|Pick it up.', ''],
  ['labay', 'throw away', 'To discard.', 'Ilabay na.|Throw it away.', ''],
  ['tago', 'hide', 'To conceal.', 'Itago ni.|Hide this.', ''],
  ['bilin', 'leave behind', 'To leave something or someone.', 'Ayaw ko bilini.|Do not leave me behind.', ''],
  ['hatod', 'take / deliver', 'To bring someone or something somewhere.', 'Ihatod ko nimo.|I will take you there.', ''],
  ['sugat', 'meet / fetch', 'To meet someone arriving.', 'Sugata siya.|Go and meet him.', ''],
  ['tawag', 'call', 'To call out to someone, to telephone, and the call itself.', 'Tawagi ko. / Naay tawag para nimo.|Call me. / There is a call for you.', ''],
  ['sulti-i', 'tell someone', 'To tell a person.', 'Sultii ko.|Tell me.', ''],
  ['pangayo', 'ask for', 'To request something.', 'Mangayo ko ug tubig.|I will ask for water.', ''],
  ['dawat', 'receive / accept', 'To take what is offered.', 'Dawata ni.|Accept this.', ''],
  ['balibad', 'refuse', 'To decline.', 'Nagbalibad siya.|He refused.', ''],
  ['saad', 'promise', 'To promise.', 'Nagsaad ko.|I promised.', ''],
  ['salig', 'trust / rely', 'To trust or depend on.', 'Salig lang nako.|Just rely on me.', ''],
  ['bantay', 'watch over', 'To guard or look after.', 'Bantayi ang bata.|Watch the child.', ''],
  ['atiman', 'take care of', 'To look after someone.', 'Atimana ang tigulang.|Care for the elder.', ''],
  ['tabangi', 'help someone', 'To assist a person.', 'Tabangi siya.|Help him.', ''],
  ['pasagdi', 'let it be', 'To leave alone.', 'Pasagdi na lang.|Just leave it be.', ''],
  ['hikay', 'prepare food', 'To set out or prepare a meal.', 'Naghikay sila.|They are preparing food.', ''],
  ['tulon', 'swallow', 'To swallow.', 'Ayaw tulona.|Do not swallow it.', ''],
  ['usap', 'chew', 'To chew.', 'Usapa pag-ayo.|Chew it well.', ''],
  ['lami-i', 'enjoy the taste', 'To savour.', 'Lami-a ang pagkaon.|Enjoy the food.', ''],
  ['lutoa', 'cook it', 'The command form of cook.', 'Lutoa ang isda.|Cook the fish.', ''],
  ['init-a', 'heat it', 'To warm something up.', 'Init-a ang sabaw.|Heat the soup.', ''],
  ['bugnawa', 'cool it', 'To cool something.', 'Bugnawa ang tubig.|Cool the water.', ''],
  ['putol', 'cut', 'To cut.', 'Putla ni.|Cut this.', ''],
  ['hiwa', 'slice', 'To slice.', 'Hiwaa ang karne.|Slice the meat.', ''],
  ['sagol', 'mix', 'To combine.', 'Sagola.|Mix it.', ''],
  ['buksi', 'unwrap / open up', 'To open a wrapping.', 'Buksi ang regalo.|Open the present.', ''],
  ['hugot', 'tighten / firm', 'To pull tight; also firm or strict.', 'Hugta.|Tighten it.', ''],
  ['luag', 'loose', 'Not tight.', 'Luag ra kaayo.|It is too loose.', ''],
  ['bira', 'pull', 'To pull.', 'Biraha.|Pull it.', ''],
  ['tulak', 'push', 'To push.', 'Tulaka.|Push it.', ''],
  ['alsa', 'lift', 'To raise something.', 'Alsaha.|Lift it.', ''],
  ['pahiluna', 'settle / arrange', 'To put in order.', 'Pahilunaa.|Arrange it.', ''],
  ['limpyoha', 'clean it', 'The command form of clean.', 'Limpyoha ang kwarto.|Clean the room.', ''],
  ['silhig', 'sweep', 'To sweep.', 'Silhigi ang salog.|Sweep the floor.', ''],
  ['trapo', 'wipe / rag', 'To wipe, and also a cloth.', 'Trapohi ang lamesa.|Wipe the table.', ''],
  ['ayo', 'repair / good', 'To fix, and the root of "maayo".', 'Ayoha ni.|Fix this.', ''],
  ['guba', 'broken / destroy', 'Broken, or to break.', 'Guba na.|It is broken.', ''],
  ['tarong', 'do properly', 'To do something right. Also an adjective for proper.', 'Tarunga pagbuhat.|Do it properly.', ''],
  ['sugot', 'agree / consent', 'To agree to something.', 'Nisugot siya.|He agreed.', ''],
  ['supak', 'oppose', 'To go against.', 'Nisupak siya.|He objected.', ''],
  ['away', 'fight / quarrel', 'To argue or fight.', 'Ayaw pag-away.|Do not fight.', ''],
  ['pasaylo', 'forgive', 'To pardon.', 'Pasayloa ko.|Forgive me.', ''],
  ['hinganlan', 'be named', 'To be called something.', 'Ginganlan siyag Juan.|He is named Juan.', ''],
  ['ila-a', 'recognise', 'To know someone by sight.', 'Wala ko kaila niya.|I do not know him.', ''],
  ['kaila', 'acquainted', 'To be acquainted with.', 'Kaila ka niya?|Do you know him?', ''],
  ['duaw', 'visit', 'To visit.', 'Moduaw ko ugma.|I will visit tomorrow.', ''],
  ['dapit', 'invite / place', 'To invite, and also a place.', 'Gidapit ko nila.|They invited me.', ''],
  ['lupad', 'fly', 'To fly.', 'Naglupad ang langgam.|The bird is flying.', ''],
  ['langoy', 'swim', 'To swim.', 'Molangoy ta.|Let us swim.', ''],
  ['kaligo', 'bathe / swim', 'To bathe, and at the sea, to swim.', 'Maligo ta sa dagat.|Let us swim in the sea.', ''],
  ['hulog', 'fall / drop', 'To fall or drop.', 'Nahulog ni.|This fell.', ''],
  ['dakop', 'catch', 'To catch or arrest.', 'Dakpa.|Catch it.', ''],
  ['buhi', 'release / alive', 'To let go, and also alive.', 'Buhii na.|Let it go.', ''],
  ['patay', 'dead / turn off', 'Dead, and also to switch off.', 'Patya ang suga.|Turn off the light.', ''],
  ['sindi', 'light / turn on', 'To switch on or light.', 'Sindihi ang suga.|Turn on the light.', ''],
]},

/* ── Quantity and comparison ─────────────────────────────────── */
{ g: 'Comparing', tags: ['grammar', 'adjectives'], w: [
  ['mas', 'more', 'Forms a comparison.', 'Mas dako ni.|This is bigger.', 'From Spanish; universal in speech.'],
  ['labing', 'most', 'Forms a superlative.', 'Labing maayo.|The best.', ''],
  ['kay sa', 'than', 'Introduces what is compared against.', 'Mas dako ni kay sa usa.|This is bigger than that one.', ''],
  ['pareho', 'same / alike', 'Equal or similar.', 'Pareho ra.|They are the same.', ''],
  ['lahi', 'different / other', 'Not the same.', 'Lahi ni.|This is different.', ''],
  ['sama sa', 'like / similar to', 'Compares by resemblance.', 'Sama sa akoa.|Like mine.', ''],
  ['kutob', 'up to / limit', 'Marks a limit.', 'Kutob ra diri.|Only up to here.', ''],
  ['sobra sa', 'more than', 'Exceeding an amount.', 'Sobra sa gatos.|More than a hundred.', ''],
  ['ubos sa', 'less than / under', 'Below an amount.', 'Ubos sa baynte.|Under twenty.', ''],
  ['igo', 'just enough / fits', 'Sufficient, or fitting exactly.', 'Igo ra.|It just fits.', ''],
  ['kulang pa', 'still not enough', 'Short of what is needed.', 'Kulang pa.|It is still not enough.', ''],
  ['hapit', 'almost', 'Nearly.', 'Hapit na.|Almost there.', ''],
  ['bisan', 'even / although', 'Concedes a point.', 'Bisan gamay.|Even a little.', ''],
  ['matag', 'each / every', 'Distributes over a set.', 'Matag adlaw.|Every day.', ''],
  ['kada', 'every', 'Every, from Spanish.', 'Kada buntag.|Every morning.', ''],
  ['usa-usa', 'one by one', 'Individually.', 'Usa-usa lang.|One at a time.', ''],
  ['tibuok', 'whole / entire', 'The entirety.', 'Tibuok adlaw.|The whole day.', ''],
  ['pila ka', 'how many', 'Asks a count.', 'Pila ka buok?|How many pieces?', ''],
]},

/* ── Getting by in a house ───────────────────────────────────── */
{ g: 'Daily routine', tags: ['home', 'routine'], w: [
  ['mata sa buntag', 'wake in the morning', 'The start of the day.', 'Nimata ko sayo sa buntag.|I woke early in the morning.', ''],
  ['panagat', 'go fishing', 'To fish for a living or for food.', 'Manganagat sila sa buntag.|They go fishing in the morning.', ''],
  ['panguma', 'farm', 'To work the land.', 'Nanguma siya.|He farms.', ''],
  ['palit sa merkado', 'shop at the market', 'The daily errand.', 'Mopalit ko sa merkado.|I will shop at the market.', ''],
  ['luto sa panihapon', 'cook dinner', 'To make the evening meal.', 'Nagluto ko sa panihapon.|I am cooking dinner.', ''],
  ['tulog sa gabii', 'sleep at night', 'To sleep.', 'Matulog ko ug sayo.|I sleep early.', ''],
  ['salog', 'floor', 'The floor.', 'Hugaw ang salog.|The floor is dirty.', ''],
  ['atop', 'roof', 'The roof.', 'Nagtulo ang atop.|The roof is leaking.', ''],
  ['bungbong', 'wall', 'A wall.', 'Puti nga bungbong.|A white wall.', ''],
  ['hagdan', 'stairs / ladder', 'Stairs.', 'Saka sa hagdan.|Go up the stairs.', ''],
  ['gripo', 'tap / faucet', 'A water tap.', 'Sirad-i ang gripo.|Close the tap.', ''],
  ['sabon', 'soap', 'Soap.', 'Walay sabon.|There is no soap.', ''],
  ['tuwalya', 'towel', 'A towel.', 'Kuhaa ang tuwalya.|Get the towel.', ''],
  ['basurahan', 'rubbish bin', 'A waste bin.', 'Ilabay sa basurahan.|Throw it in the bin.', ''],
  ['basura', 'rubbish', 'Waste.', 'Daghang basura.|A lot of rubbish.', ''],
  ['kaldero', 'pot', 'A cooking pot.', 'Dako nga kaldero.|A big pot.', ''],
  ['kutsilyo', 'knife', 'A knife.', 'Hait nga kutsilyo.|A sharp knife.', ''],
  ['kalan', 'stove', 'A cooking stove.', 'Sindihi ang kalan.|Light the stove.', ''],
  ['ref', 'fridge', 'A refrigerator. Borrowed and shortened.', 'Ibutang sa ref.|Put it in the fridge.', ''],
  ['kurtina', 'curtain', 'A curtain.', 'Sirad-i ang kurtina.|Close the curtain.', ''],
  ['banig', 'sleeping mat', 'A woven mat slept on, common in homes.', 'Buklara ang banig.|Spread out the mat.', ''],
]},

/* ── The sea, which is most of the Visayas ───────────────────── */
{ g: 'Sea and fishing', tags: ['sea', 'nature', 'work'], w: [
  ['mananagat', 'fisherman', 'Someone who fishes for a living.', 'Mananagat akong amahan.|My father is a fisherman.', ''],
  ['baroto', 'small boat', 'A small outrigger boat.', 'Gamay nga baroto.|A small boat.', ''],
  ['bangka', 'boat', 'A boat.', 'Sakay ta sa bangka.|Let us ride the boat.', ''],
  ['pukot', 'fishing net', 'A net.', 'Gilabay ang pukot.|The net was cast.', ''],
  ['taga', 'hook / fishing line', 'A fishing hook.', 'Nawala ang taga.|The hook was lost.', ''],
  ['baybayon', 'beach / shore', 'The shore.', 'Adto ta sa baybayon.|Let us go to the beach.', ''],
  ['balod', 'wave', 'A wave.', 'Dagko ang balod.|The waves are big.', ''],
  ['sulog', 'current', 'A water current.', 'Kusog ang sulog.|The current is strong.', ''],
  ['taob', 'high tide', 'When the sea comes in.', 'Taob na.|The tide is in.', ''],
  ['hunas', 'low tide', 'When the sea goes out, exposing the flats.', 'Hunas karon.|It is low tide now.', 'Gleaning the flats at low tide is a real daily activity, not a curiosity.'],
  ['isdaan', 'fish market', 'Where fish is sold.', 'Adto sa isdaan.|Go to the fish market.', ''],
  ['bugana', 'plentiful', 'Abundant, said of a catch or a harvest.', 'Bugana ang kuha.|The catch was plentiful.', ''],
  ['pasayan', 'shrimp', 'Shrimp.', 'Lami ang pasayan.|The shrimp is delicious.', ''],
  ['alimango', 'crab', 'Crab.', 'Dako nga alimango.|A big crab.', ''],
  ['kinhason', 'shellfish', 'Shellfish gathered from the shore.', 'Nangita mig kinhason.|We gathered shellfish.', ''],
  ['bulad', 'dried fish', 'Sun-dried fish, a staple.', 'Bulad ug kan-on.|Dried fish and rice.', ''],
  ['presko', 'fresh', 'Fresh, especially of fish.', 'Presko ba ni?|Is this fresh?', 'The question to ask before buying fish.'],
  ['lawom', 'deep', 'Deep.', 'Lawom ang dagat.|The sea is deep.', ''],
  ['mabaw', 'shallow', 'Not deep.', 'Mabaw ra diri.|It is shallow here.', ''],
]},

/* ── The land ────────────────────────────────────────────────── */
{ g: 'Farming', tags: ['farming', 'nature', 'work'], w: [
  ['mag-uuma', 'farmer', 'Someone who farms.', 'Mag-uuma siya.|He is a farmer.', ''],
  ['tanom', 'plant', 'To plant, and a plant.', 'Nagtanom sila ug mais.|They planted corn.', ''],
  ['ani', 'harvest', 'To harvest, and the harvest.', 'Ting-ani na.|It is harvest time.', ''],
  ['mais', 'corn', 'Maize.', 'Sinugbang mais.|Grilled corn.', ''],
  ['tubo', 'sugarcane / grow', 'Sugarcane, and also to grow.', 'Uma sa tubo.|A sugarcane field.', ''],
  ['abono', 'fertiliser', 'Fertiliser.', 'Kinahanglan ug abono.|It needs fertiliser.', ''],
  ['bugsay', 'paddle', 'A paddle, and to paddle.', 'Bugsayi.|Paddle it.', ''],
  ['kamot sa yuta', 'work the soil', 'To till.', 'Nagkamot sa yuta.|Working the soil.', ''],
  ['sagbot', 'weeds / grass', 'Weeds or grass.', 'Daghang sagbot.|Lots of weeds.', ''],
  ['bunga', 'fruit / result', 'Fruit of a plant, and the result of an effort.', 'Bunga sa kahago.|The fruit of hard work.', ''],
  ['gagmay nga hayop', 'small livestock', 'Small farm animals.', 'Nag-atiman ug gagmay nga hayop.|Raising small livestock.', ''],
  ['hayop', 'animal / livestock', 'An animal.', 'Daghan siyag hayop.|He has many animals.', ''],
  ['kahago', 'hard work / toil', 'Hard labour.', 'Bug-at nga kahago.|Heavy toil.', ''],
  ['ting-ulan', 'rainy season', 'The wet season.', 'Ting-ulan na.|The rainy season is here.', ''],
  ['ting-init', 'dry season', 'The hot season.', 'Ting-init karon.|It is the dry season now.', ''],
]},

/* ── Eating well ─────────────────────────────────────────────── */
{ g: 'Cooking and dishes', tags: ['food', 'cooking'], w: [
  ['sugba', 'grill', 'To grill over coals — the commonest way to cook fish.', 'Sugbaa ang isda.|Grill the fish.', ''],
  ['prito', 'fry', 'To fry.', 'Pritoha ang itlog.|Fry the egg.', ''],
  ['linat-an', 'boiled dish', 'A boiled dish, usually with broth.', 'Linat-ang baka.|Boiled beef.', ''],
  ['tinola', 'ginger soup', 'A clear soup with ginger, usually chicken or fish.', 'Tinolang manok.|Chicken tinola.', ''],
  ['adobo', 'adobo', 'Meat stewed in vinegar, soy and garlic.', 'Adobong baboy.|Pork adobo.', ''],
  ['kinilaw', 'raw fish in vinegar', 'Raw fish cured in vinegar — the Visayan dish.', 'Kinilaw nga isda.|Fish kinilaw.', ''],
  ['lechon', 'roast pig', 'Whole roast pig, the centrepiece of a feast.', 'Lechon sa pista.|Lechon at the fiesta.', ''],
  ['humba', 'braised pork', 'Sweet braised pork, a Visayan staple.', 'Lami ang humba.|The humba is delicious.', ''],
  ['utan', 'vegetable soup', 'A simple vegetable dish.', 'Utan nga kalabasa.|Squash soup.', ''],
  ['toyo', 'soy sauce', 'Soy sauce.', 'Toyo ug kalamansi.|Soy sauce and calamansi.', ''],
  ['kalamansi', 'calamansi', 'The small local citrus, used on everything.', 'Piga ang kalamansi.|Squeeze the calamansi.', ''],
  ['sili', 'chilli', 'Chilli pepper.', 'Halang ang sili.|The chilli is hot.', ''],
  ['ahos', 'garlic', 'Garlic.', 'Gilinis ang ahos.|The garlic was peeled.', ''],
  ['sibuyas', 'onion', 'Onion.', 'Hiwaa ang sibuyas.|Slice the onion.', ''],
  ['luy-a', 'ginger', 'Ginger.', 'Butangi ug luy-a.|Add some ginger.', ''],
  ['mantika', 'cooking oil', 'Oil for cooking.', 'Init ang mantika.|The oil is hot.', ''],
  ['harina', 'flour', 'Flour.', 'Puti nga harina.|White flour.', ''],
  ['kalabasa', 'squash', 'Squash or pumpkin.', 'Utan nga kalabasa.|Squash stew.', ''],
  ['talong', 'eggplant', 'Aubergine.', 'Sinugbang talong.|Grilled eggplant.', ''],
  ['kamatis', 'tomato', 'Tomato.', 'Pula nga kamatis.|A red tomato.', ''],
  ['patatas', 'potato', 'Potato.', 'Linat-ang patatas.|Boiled potato.', ''],
  ['monggos', 'mung beans', 'Mung bean stew, eaten on Fridays in many households.', 'Monggos sa Biyernes.|Mung beans on Friday.', ''],
  ['puso', 'hanging rice', 'Rice cooked in a woven coconut-leaf pouch.', 'Puso ug barbecue.|Hanging rice and barbecue.', 'The standard street pairing in Cebu.'],
  ['tuba', 'coconut wine', 'Fermented coconut sap.', 'Nag-inom silag tuba.|They are drinking tuba.', ''],
  ['gutom na ko', 'I am hungry now', 'A statement of need.', 'Gutom na ko.|I am hungry now.', ''],
  ['pasugba', 'have it grilled', 'To ask for something to be grilled.', 'Pasugbaa ni.|Have this grilled.', ''],
  ['init pa', 'still hot', 'Freshly cooked.', 'Init pa ni.|This is still hot.', ''],
]},

/* ── Travel ──────────────────────────────────────────────────── */
{ g: 'Travel', tags: ['travel', 'places'], w: [
  ['biyahe', 'trip / journey', 'A journey.', 'Taas nga biyahe.|A long journey.', ''],
  ['plete', 'fare', 'The fare for transport.', 'Pila ang plete?|How much is the fare?', ''],
  ['terminal', 'terminal', 'A transport terminal.', 'Sa terminal ta magkita.|Let us meet at the terminal.', ''],
  ['pantalan', 'pier / wharf', 'A port.', 'Adto sa pantalan.|Go to the pier.', ''],
  ['tugpahanan', 'airport', 'An airport.', 'Sa tugpahanan.|At the airport.', ''],
  ['lugar', 'place / spot', 'A place. Also called out to stop a jeepney.', 'Lugar lang!|Stop here, please!', 'Saying "lugar lang" is how you get off a jeepney.'],
  ['abton', 'reach / arrive at', 'To get to a place.', 'Abton nato ang barko.|We will catch the boat.', ''],
  ['ulahi sa biyahe', 'miss the trip', 'To be too late.', 'Naulahi ko sa biyahe.|I missed the trip.', ''],
  ['dala-dala', 'luggage', 'Things carried.', 'Daghan kog dala-dala.|I have a lot of luggage.', ''],
  ['pasaporte', 'passport', 'A passport.', 'Hain ang pasaporte?|Where is the passport?', ''],
  ['mapa', 'map', 'A map.', 'Tan-awa ang mapa.|Look at the map.', ''],
  ['dalan padulong', 'the way to', 'The route somewhere.', 'Unsay dalan padulong sa syudad?|What is the way to the city?', ''],
  ['nasaag', 'lost (wandering)', 'To have lost one\'s way.', 'Nasaag ko.|I am lost.', ''],
  ['nawala', 'lost (missing)', 'Something that has gone missing.', 'Nawala akong yawe.|My key is lost.', 'Different from "nasaag", which is only for people losing their way.'],
  ['duol ra ba', 'is it near', 'Asks about distance.', 'Duol ra ba?|Is it near?', ''],
  ['unsa ka layo', 'how far', 'Asks a distance.', 'Unsa ka layo?|How far is it?', ''],
]},

/* ── Ideas and abstractions ──────────────────────────────────── */
{ g: 'Ideas', tags: ['abstract'], w: [
  ['kinabuhi', 'life', 'Life.', 'Lisod ang kinabuhi.|Life is hard.', ''],
  ['kamatayon', 'death', 'Death.', 'Hadlok sa kamatayon.|Fear of death.', ''],
  ['gugma', 'love', 'Love.', 'Gugma sa pamilya.|Family love.', ''],
  ['kalipay', 'happiness', 'Joy.', 'Kalipay sa kasingkasing.|Joy in the heart.', ''],
  ['kasubo', 'sorrow', 'Sadness.', 'Dako nga kasubo.|A great sorrow.', ''],
  ['paglaum', 'hope', 'Hope.', 'Ayaw pagwala sa paglaum.|Do not lose hope.', ''],
  ['kahadlok', 'fear', 'Fear.', 'Kahadlok sa halas.|Fear of snakes.', ''],
  ['kaisog', 'courage', 'Bravery.', 'Kinahanglan ug kaisog.|It takes courage.', ''],
  ['kamatuoran', 'truth', 'The truth.', 'Isulti ang kamatuoran.|Tell the truth.', ''],
  ['katarungan', 'justice / reason', 'Justice, and also a reason.', 'Walay katarungan.|There is no justice.', ''],
  ['kalinaw', 'peace', 'Peace.', 'Kalinaw sa lungsod.|Peace in the town.', ''],
  ['panahon', 'time / weather', 'Time, and also the weather.', 'Nindot ang panahon.|The weather is fine.', 'One word for both, as in English "the times" and "the weather".'],
  ['kahigayonan', 'opportunity', 'A chance.', 'Usa ka kahigayonan.|An opportunity.', ''],
  ['kalisod', 'difficulty / hardship', 'Hardship.', 'Daghang kalisod.|Many hardships.', ''],
  ['kalampusan', 'success', 'Success.', 'Kalampusan sa trabaho.|Success at work.', ''],
  ['tinguha', 'desire / aim', 'A wish or aim.', 'Akong tinguha.|My aim.', ''],
  ['hunahuna', 'thought / mind', 'A thought, and to think.', 'Unsay imong hunahuna?|What do you think?', ''],
  ['pagtuo', 'belief / faith', 'Belief.', 'Lig-on nga pagtuo.|Strong faith.', ''],
  ['kabubut-on', 'will / wish', 'One\'s will.', 'Kabubut-on sa Ginoo.|God\'s will.', ''],
  ['pagbati', 'feeling', 'A feeling or emotion.', 'Lawom nga pagbati.|A deep feeling.', ''],
  ['handurawan', 'memory / imagination', 'Recollection.', 'Sa akong handurawan.|In my memory.', ''],
  ['damgo', 'dream', 'A dream, sleeping or waking.', 'Akong damgo.|My dream.', ''],
  ['pasalig', 'assurance', 'A promise or assurance.', 'Walay pasalig.|There is no assurance.', ''],
]},

/* ── Describing people ───────────────────────────────────────── */
{ g: 'Character', tags: ['adjectives', 'people'], w: [
  ['buotan', 'kind / well-behaved', 'Good-natured. High praise for a person.', 'Buotan kaayo siya.|He is very kind.', 'The commonest compliment about someone\'s character.'],
  ['bugoy', 'unruly / troublemaker', 'Rough or badly behaved.', 'Bugoy nga bata.|An unruly child.', ''],
  ['tapulan', 'lazy', 'Unwilling to work.', 'Tapulan siya.|He is lazy.', ''],
  ['kugihan', 'hardworking / diligent', 'Industrious.', 'Kugihan siya motrabaho.|He works hard.', ''],
  ['maalamon', 'wise / clever', 'Intelligent.', 'Maalamon nga tawo.|A wise person.', ''],
  ['buang', 'crazy / foolish', 'Mad, or acting foolishly. Used jokingly among friends.', 'Buang ka!|You are crazy!', 'Between friends it is teasing; to a stranger it is an insult.'],
  ['maulawon', 'shy', 'Reserved.', 'Maulawon siya.|She is shy.', ''],
  ['isog', 'brave / fierce', 'Bold, or fierce.', 'Isog nga bata.|A brave child.', ''],
  ['talawan', 'cowardly', 'Lacking courage.', 'Talawan siya.|He is a coward.', ''],
  ['hakog', 'greedy / selfish', 'Unwilling to share.', 'Ayaw pagkahakog.|Do not be greedy.', ''],
  ['manggihatagon', 'generous', 'Willing to give.', 'Manggihatagon siya.|She is generous.', ''],
  ['matinud-anon', 'honest', 'Truthful.', 'Matinud-anon nga tawo.|An honest person.', ''],
  ['bakakon', 'liar', 'One who lies.', 'Bakakon siya.|He is a liar.', ''],
  ['mapainubsanon', 'humble', 'Modest.', 'Mapainubsanon siya.|He is humble.', ''],
  ['garboso', 'proud / boastful', 'Showing off.', 'Garboso kaayo.|Very boastful.', ''],
  ['mapasensyahon', 'patient', 'Able to wait or endure.', 'Mapasensyahon siya.|He is patient.', ''],
  ['init ug ulo', 'hot-tempered', 'Quick to anger. Literally "hot of head".', 'Init ug ulo siya.|He has a temper.', ''],
  ['malumo', 'gentle / soft', 'Gentle in manner.', 'Malumo nga tingog.|A gentle voice.', ''],
  ['hilomon', 'quiet (person)', 'Not talkative.', 'Hilomon siya.|He is quiet.', ''],
  ['saba', 'noisy / loud', 'Making noise. Also "be quiet" as a command.', 'Saba kaayo!|So noisy!', '"Saba!" alone is "shut up" and is sharp.'],
]},

/* ── Reactions ───────────────────────────────────────────────── */
{ g: 'Reactions', tags: ['phrases', 'feelings'], w: [
  ['pastilan', 'good grief / my word', 'An exclamation of dismay or amazement. Very Visayan.', 'Pastilan!|Good grief!', 'Mild and widely used; the closest thing to a signature Cebuano exclamation.'],
  ['sus', 'goodness', 'A short exclamation of surprise or exasperation.', 'Sus, ikaw gyud.|Goodness, it is you.', 'From "Jesus"; entirely mild in use.'],
  ['agi', 'ouch / oh', 'An exclamation of small pain or surprise.', 'Agi!|Ouch!', ''],
  ['ayay', 'ouch', 'An exclamation of pain.', 'Ayay, sakit!|Ouch, that hurts!', ''],
  ['hala', 'oh no / go on', 'Marks alarm, or urges someone on.', 'Hala, nadagma siya.|Oh no, he fell.', ''],
  ['lagi', '(agreement / insistence)', 'Confirms or insists, often with mild exasperation.', 'Oo lagi.|Yes, of course.', ''],
  ['uy', '(attention / softener)', 'Calls attention, or softens what follows.', 'Nindot uy!|That is nice!', ''],
  ['bitaw', 'indeed / that is right', 'Agrees with what was said.', 'Bitaw, tinuod.|Indeed, it is true.', ''],
  ['gani', 'in fact / especially', 'Adds emphasis or a further point.', 'Gani, nakalimot ko.|In fact, I forgot.', ''],
  ['nindot kaayo', 'how lovely', 'A compliment.', 'Nindot kaayo ni!|This is lovely!', ''],
  ['grabe', 'intense / too much', 'Marks something extreme, good or bad.', 'Grabe ang init.|The heat is extreme.', ''],
  ['kalami', 'how delicious', 'An exclamation about taste.', 'Kalami!|How delicious!', 'The "ka-" prefix turns an adjective into an exclamation.'],
  ['kanindot', 'how beautiful', 'An exclamation about beauty.', 'Kanindot sa view!|What a lovely view!', ''],
  ['salamat kaayo', 'thank you very much', 'Warm thanks.', 'Salamat kaayo nimo.|Thank you very much.', ''],
  ['wa lang', 'nothing / never mind', 'Dismisses a question about what is wrong.', 'Wa lang.|It is nothing.', ''],
  ['bahala na', 'come what may', 'Accepts an uncertain outcome. A well-known Filipino attitude.', 'Bahala na.|Come what may.', 'Resignation and courage at once; not simply fatalism.'],
]},

/* ── Modern life ─────────────────────────────────────────────── */
{ g: 'Modern life', tags: ['technology', 'modern'], w: [
  ['selpon', 'mobile phone', 'A mobile phone.', 'Hain akong selpon?|Where is my phone?', ''],
  ['load', 'phone credit', 'Prepaid mobile credit.', 'Wala koy load.|I have no credit.', ''],
  ['signal', 'signal', 'Phone or internet signal.', 'Walay signal diri.|There is no signal here.', ''],
  ['internet', 'internet', 'The internet.', 'Hinay ang internet.|The internet is slow.', ''],
  ['text', 'text message', 'An SMS. Used as a verb too.', 'Text lang ko.|Just text me.', ''],
  ['kuryente', 'electricity', 'Electric power.', 'Walay kuryente.|There is no electricity.', ''],
  ['brownout', 'power cut', 'A loss of electricity. The local word, not "blackout".', 'Naay brownout.|There is a power cut.', ''],
  ['tubig nga mineral', 'bottled water', 'Purified drinking water.', 'Palit ug tubig nga mineral.|Buy bottled water.', ''],
  ['motor', 'motorcycle', 'A motorbike.', 'Sakay sa motor.|Ride the motorbike.', ''],
  ['sakyanan', 'vehicle', 'A vehicle.', 'Daghang sakyanan.|Many vehicles.', ''],
  ['gasolina', 'petrol', 'Fuel.', 'Kulang ang gasolina.|There is not enough petrol.', ''],
  ['tindahan sari-sari', 'corner shop', 'The small neighbourhood store.', 'Palit sa sari-sari.|Buy at the corner shop.', ''],
  ['resibo', 'receipt', 'A receipt.', 'Hangyoa ang resibo.|Ask for the receipt.', ''],
  ['kwarta sa bangko', 'money in the bank', 'Savings.', 'Naa koy kwarta sa bangko.|I have money in the bank.', ''],
  ['trabahong gawas', 'work abroad', 'Overseas work — a fact of life in many families.', 'Nagtrabaho siya sa gawas.|He works abroad.', ''],
  ['padala', 'remittance / send', 'Money sent home, and the act of sending.', 'Naay padala gikan sa gawas.|There is a remittance from abroad.', ''],
]},

/* ── Sounds, textures, states ────────────────────────────────── */
{ g: 'More descriptions', tags: ['adjectives'], w: [
  ['hait', 'sharp', 'Having a fine edge.', 'Hait nga kutsilyo.|A sharp knife.', ''],
  ['humok', 'soft', 'Soft to the touch.', 'Humok nga unlan.|A soft pillow.', ''],
  ['gahi', 'hard / stubborn', 'Hard, and of a person, stubborn.', 'Gahi ang bato.|The stone is hard.', ''],
  ['hamis', 'smooth', 'Smooth.', 'Hamis nga panit.|Smooth skin.', ''],
  ['bagis', 'rough', 'Rough to the touch.', 'Bagis ang kamot.|The hands are rough.', ''],
  ['uga', 'dry', 'Dry.', 'Uga na ang labada.|The laundry is dry.', ''],
  ['hinog', 'ripe', 'Ready to eat.', 'Hinog na ang mangga.|The mango is ripe.', ''],
  ['hilaw', 'unripe / raw', 'Not ripe, or uncooked.', 'Hilaw pa.|It is still unripe.', ''],
  ['lami-an', 'tasty', 'Full of flavour.', 'Lami-an ang sud-an.|The dish is tasty.', ''],
  ['tab-ang', 'bland / fresh water', 'Without flavour; also fresh as opposed to salt water.', 'Tab-ang ang sabaw.|The soup is bland.', ''],
  ['baho', 'smelly / smell', 'A bad smell.', 'Baho kaayo.|It smells bad.', ''],
  ['humot', 'fragrant', 'Sweet-smelling.', 'Humot ang bulak.|The flower is fragrant.', ''],
  ['hayag', 'bright', 'Full of light.', 'Hayag ang kwarto.|The room is bright.', ''],
  ['ngitngit', 'dark', 'Without light.', 'Ngitngit kaayo.|It is very dark.', ''],
  ['tin-aw', 'clear', 'Clear or transparent.', 'Tin-aw ang tubig.|The water is clear.', ''],
  ['lubog', 'murky', 'Cloudy or muddy.', 'Lubog ang suba.|The river is murky.', ''],
  ['bag-ong luto', 'freshly cooked', 'Just made.', 'Bag-ong luto ni.|This is freshly cooked.', ''],
  ['daot', 'spoiled / damaged', 'Gone bad.', 'Daot na ang karne.|The meat has spoiled.', ''],
  ['lig-on', 'sturdy / strong', 'Solid or firm.', 'Lig-on nga balay.|A sturdy house.', ''],
  ['huyang', 'weak / frail', 'Lacking strength.', 'Huyang ang lawas.|The body is weak.', ''],
  ['sayon ra', 'quite easy', 'Not difficult at all.', 'Sayon ra kaayo.|It is very easy.', ''],
  ['lisod kaayo', 'very hard', 'Extremely difficult.', 'Lisod kaayo ni.|This is very hard.', ''],
  ['hilom', 'quiet / silence', 'Silent.', 'Hilom sa gabii.|Quiet at night.', ''],
  ['kusog ang tingog', 'loud voice', 'Speaking loudly.', 'Kusog imong tingog.|Your voice is loud.', ''],
  ['tingog', 'voice / sound', 'A voice or sound.', 'Nindot iyang tingog.|Her voice is lovely.', ''],
]},

/* ── Endearment and address ──────────────────────────────────── */
{ g: 'Terms of address', tags: ['social', 'people'], w: [
  ['langga', 'darling', 'An affectionate term for a partner, child or close friend.', 'Kumusta, langga?|How are you, darling?', 'Warm and common; not restricted to romance.'],
  ['gwapa ko', 'I am pretty', 'Said playfully about oneself.', 'Gwapa ko, no?|I am pretty, right?', ''],
  ['bai', 'mate / bro', 'Casual address between men, very Cebuano.', 'Bai, asa ka?|Mate, where are you going?', ''],
  ['pre', 'pal', 'Short for "pareha" or "compadre"; casual address.', 'Pre, tabang.|Pal, help me out.', ''],
  ['igsoon ko', 'my sibling', 'Used warmly beyond actual family.', 'Igsoon ko siya.|He is like my brother.', ''],
  ['manong', 'older brother / sir', 'Respectful for an older man, and for an elder brother.', 'Salamat, manong.|Thank you, sir.', ''],
  ['manang', 'older sister / ma\'am', 'Respectful for an older woman.', 'Manang, palihug.|Ma\'am, please.', ''],
  ['tita', 'aunt', 'Aunt, and used for any family friend of that generation.', 'Si tita miabot.|Auntie has arrived.', ''],
  ['tito', 'uncle', 'Uncle, used the same way.', 'Si tito nagtrabaho.|Uncle is working.', ''],
  ['inday', 'girl / miss', 'Address for a girl or young woman.', 'Inday, ari sa.|Come here, dear.', ''],
  ['dodong', 'boy / lad', 'Address for a boy or young man.', 'Dodong, tabangi ko.|Lad, help me.', ''],
]},

];


/* ── Building it ─────────────────────────────────────────────── */

/** Every row, flattened, with its group's tags attached. */
function langCebPackRows() {
  const out = [];
  LANG_CEB_PACK.forEach(group => {
    (group.w || []).forEach(row => {
      out.push({
        ceb: row[0], en: row[1], desc: row[2],
        example: row[3] || '', note: row[4] || '',
        group: group.g, tags: (group.tags || []).slice()
      });
    });
  });
  return out;
}

/** How many words the pack holds, without building any of them. */
function langCebPackSize() {
  return LANG_CEB_PACK.reduce((n, g) => n + ((g.w || []).length), 0);
}

/**
 * One row as a word record.
 *
 * The English side carries the short handle and the description; the Cebuano
 * side carries the term, the same description and any usage note, plus the
 * example sentence. That split matters for the run: langEnemyFromWords asks a
 * question from the reference language and expects the study language back, so
 * both sides have to have a term or the word cannot be used in play.
 */
function _langCebWord(r) {
  const rec = langBlankWord();
  rec.tags = r.tags.concat([r.group.toLowerCase()]);
  rec.forms.ceb = {
    term: r.ceb,
    pos: '',
    definition: r.desc,
    examples: r.example && r.example.indexOf('|') > -1
      ? [{ id: generateId(),
           text: r.example.split('|')[0].trim(),
           gloss: r.example.split('|')[1].trim() }]
      : [],
    notes: '',
    restrictions: r.note || ''
  };
  rec.forms.en = {
    term: r.en, pos: '', definition: r.desc,
    examples: [], notes: '', restrictions: ''
  };
  return rec;
}

/**
 * Install the pack, skipping anything already there by Cebuano term.
 *
 * Skipping rather than replacing, for the same reason the coding pack does it:
 * a word you have edited is yours, and a starter pack that overwrites your own
 * definitions is a starter pack you can only safely run once.
 *
 * @returns {{added:number, skipped:number, total:number}}
 */
function langAddCebPack() {
  langStore();
  const res = { added: 0, skipped: 0, total: 0 };
  const have = new Set();
  langWords().forEach(w => {
    const t = langForm(w, 'ceb').term.trim().toLowerCase();
    if (t) have.add(t);
  });
  langCebPackRows().forEach(r => {
    res.total++;
    if (have.has(r.ceb.trim().toLowerCase())) { res.skipped++; return; }
    if (langSaveWord(_langCebWord(r))) { res.added++; have.add(r.ceb.trim().toLowerCase()); }
  });
  saveData();
  if (typeof langRefreshViews === 'function') langRefreshViews();
  return res;
}

/** The button. Confirms first, because it writes several hundred records. */
function langLoadCebPack() {
  const size = langCebPackSize();
  const groups = LANG_CEB_PACK.length;
  const already = langWords().length;
  showConfirm('Add the Cebuano core pack?',
    size + ' Cebuano words across ' + groups + ' topics, each with an English gloss, '
    + 'a description of how it is actually used, and an example sentence. '
    + 'Nothing is replaced — anything you already have by the same Cebuano term is skipped.'
    + (already ? ' You currently have ' + already + ' word' + (already === 1 ? '' : 's') + '.' : ''),
    () => {
      const r = langAddCebPack();
      if (typeof toast === 'function') {
        toast(r.added
          ? 'Added ' + r.added + ' Cebuano words.'
            + (r.skipped ? ' ' + r.skipped + ' were already there.' : '')
          : 'Every word in the pack was already there.',
          { type: r.added ? 'success' : 'info', duration: 6000 });
      }
    });
}
