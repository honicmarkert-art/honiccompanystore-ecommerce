/**
 * Tanzania address hierarchy: Region → District → Ward.
 * Single source of truth for checkout and location flows.
 */

export const TANZANIA_REGIONS = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma',
  'Kilimanjaro', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza',
  'Njombe', 'Pemba North', 'Pemba South', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga',
  'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga', 'Zanzibar Central/South', 'Zanzibar North', 'Zanzibar Urban/West',
] as const

export const DISTRICTS_BY_REGION: Record<string, string[]> = {
  'Dar es Salaam': ['Ilala', 'Kinondoni', 'Temeke', 'Ubungo', 'Kigamboni'],
  'Arusha': ['Arusha City', 'Arusha DC', 'Meru', 'Monduli', 'Karatu', 'Longido', 'Ngorongoro'],
  'Mwanza': ['Ilemela', 'Nyamagana', 'Magu', 'Sengerema', 'Ukerewe', 'Misungwi'],
  'Dodoma': ['Dodoma Urban', 'Dodoma Rural', 'Kondoa', 'Mpwapwa', 'Kongwa', 'Chemba'],
  'Mbeya': ['Mbeya City', 'Mbeya DC', 'Chunya', 'Kyela', 'Mbozi', 'Rungwe'],
  'Tanga': ['Tanga City', 'Muheza', 'Pangani', 'Korogwe', 'Lushoto', 'Handeni', 'Kilindi'],
  'Morogoro': ['Morogoro Urban', 'Morogoro Rural', 'Kilosa', 'Gairo', 'Kilombero', 'Ulanga', 'Mvomero'],
  'Kilimanjaro': ['Moshi Urban', 'Moshi Rural', 'Hai', 'Rombo', 'Same', 'Mwanga'],
  'Mara': ['Musoma Urban', 'Musoma Rural', 'Tarime', 'Serengeti', 'Bunda', 'Butiama', 'Rorya'],
  'Kagera': ['Bukoba Urban', 'Bukoba Rural', 'Muleba', 'Karagwe', 'Biharamulo', 'Ngara', 'Kyerwa'],
  'Iringa': ['Iringa Urban', 'Iringa Rural', 'Kilolo', 'Mufindi', 'Makete', 'Ludewa'],
  'Tabora': ['Tabora Urban', 'Tabora Rural', 'Urambo', 'Sikonge', 'Nzega', 'Igunga'],
  'Kigoma': ['Kigoma Urban', 'Kigoma Rural', 'Kasulu', 'Kibondo', 'Uvinza', 'Buhigwe'],
  'Mtwara': ['Mtwara Urban', 'Mtwara Rural', 'Masasi', 'Nanyumbu', 'Tandahimba', 'Newala'],
  'Lindi': ['Lindi Urban', 'Lindi Rural', 'Kilwa', 'Liwale', 'Ruangwa', 'Nachingwea'],
  'Ruvuma': ['Songea Urban', 'Songea Rural', 'Tunduru', 'Mbinga', 'Namtumbo', 'Nyasa'],
  'Shinyanga': ['Shinyanga Urban', 'Shinyanga Rural', 'Kahama', 'Maswa', 'Meatu', 'Bariadi'],
  'Singida': ['Singida Urban', 'Singida Rural', 'Iramba', 'Manyoni', 'Mkalama', 'Ikungi'],
  'Pwani': ['Kibaha', 'Bagamoyo', 'Kisarawe', 'Rufiji', 'Mkuranga', 'Mafia', 'Kibiti'],
  'Rukwa': ['Sumbawanga Urban', 'Sumbawanga Rural', 'Nkasi', 'Kalambo'],
  'Manyara': ['Babati', 'Hanang', 'Mbulu', 'Simanjiro', 'Kiteto', 'Karatu'],
  'Njombe': ['Njombe Urban', 'Njombe Rural', 'Ludewa', 'Makete', 'Wanging\'ombe'],
  'Geita': ['Geita', 'Bukombe', 'Chato', 'Mbogwe', 'Nyang\'hwale'],
  'Simiyu': ['Bariadi', 'Busega', 'Itilima', 'Maswa', 'Meatu'],
  'Katavi': ['Mpanda Urban', 'Mpanda Rural', 'Mlele', 'Nkasi'],
  'Songwe': ['Mbeya City', 'Kyela', 'Mbozi', 'Ileje', 'Momba'],
  'Pemba North': ['Wete', 'Micheweni', 'Konde'],
  'Pemba South': ['Chake Chake', 'Mkoani', 'Wawi'],
  'Zanzibar Urban/West': ['Magharibi', 'Mjini', 'Kaskazini A', 'Kaskazini B', 'Kusini'],
  'Zanzibar North': ['Kaskazini A', 'Kaskazini B'],
  'Zanzibar Central/South': ['Kati', 'Kusini'],
}

export const WARDS_BY_DISTRICT: Record<string, string[]> = {
  'Ilala': [
    'Bonyokwa', 'Buguruni', 'Buyuni', 'Chanika', 'Gerezani', 'Gongolamboto', 'Ilala', 'Jangwani', 'Liwiti',
    'Kariakoo', 'Kimanga', 'Kinyerezi', 'Kipawa', 'Kipunguni', 'Kisukuru', 'Kitunda', 'Kisutu', 'Kivukoni',
    'Kivule', 'Kiwalani', 'Majohe', 'Mchafukoge', 'Mchikichini', 'Minazi Mirefu', 'Mnyamani', 'Msongola',
    'Mzinga', 'Pugu', 'Pugu Station', 'Segerea', 'Tabata', 'Ukonga', 'Upanga East', 'Upanga West', 'Vingunguti', 'Zingiziwa'
  ],
  'Kinondoni': [
    'Bunju', 'Hananasif', 'Kawe', 'Kigogo', 'Kijitonyama', 'Kinondoni', 'Kunduchi', 'Mabwepande', 'Magomeni',
    'Makongo', 'Makumbusho', 'Mbezi Juu', 'Mbweni', 'Mikocheni', 'Msasani', 'Mwananyamala', 'Mzimuni', 'Ndugumbi', 'Tandale', 'Wazo'
  ],
  'Temeke': [
    'Azimio', 'Chamazi', 'Chang\'ombe', 'Charambe', 'Keko', 'Kigamboni', 'Kibada', 'Kimbiji', 'Kisarawe II',
    'Kurasini', 'Makangarawe', 'Mbagala', 'Mbagala Kuu', 'Miburani', 'Mjimwema', 'Mtoni', 'Pemba Mnazi',
    'Sandali', 'Somangira', 'Tandika', 'Temeke', 'Toangoma', 'Vijibweni', 'Yombo Vituka'
  ],
  'Ubungo': [
    'Goba', 'Kibamba', 'Kimara', 'Kwembe', 'Mabibo', 'Makuburi', 'Makurumla', 'Manzese', 'Mbezi',
    'Mburahati', 'Msigani', 'Saranga', 'Sinza', 'Ubungo'
  ],
  'Kigamboni': [
    'Tungi', 'Vijibweni', 'Kimbiji', 'Kisarawe II', 'Kigamboni', 'Mjimwema', 'Kibada', 'Somangila', 'Pembamnazi'
  ],
  'Arusha City': [
    'Baraa', 'Daraja Mbili', 'Elerai', 'Engutoto', 'Kaloleni', 'Kati', 'Kimandolu', 'Lemara', 'Levolosi',
    'Moivaro', 'Moshono', 'Muriet', 'Ngarenaro', 'Olasiti', 'Olmoti', 'Oloirien', 'Osunyai Jr', 'Sakina',
    'Sekei', 'Sinoni', 'Sokoni I', 'Sombetini', 'Terrat', 'Themi', 'Unga Limited'
  ],
  'Arusha DC': [
    'Bangata', 'Bwawani', 'Ilboru', 'Ilkiding\'a', 'Kimnyaki', 'Kiranyi', 'Kisongo', 'Kiutu', 'Laroi',
    'Lemanyata', 'Lengijave', 'Mateves', 'Mlangarini', 'Moivo', 'Mussa', 'Mwandeti', 'Nduruma',
    'Oldonyosambu', 'Oldonyowass', 'Oljoro', 'Olmotonyi', 'Olorieni', 'Oltoroto', 'Oltrumet',
    'Sambasha', 'Sokoni II', 'Tarakwa'
  ],
  'Meru': [
    'Akheri', 'Ambureni', 'Imbaseni', 'Kikatiti', 'Kikwe', 'King\'ori', 'Leguruki', 'Majengo', 'Maji ya Chai',
    'Makiba', 'Malula', 'Maroroni', 'Maruvango', 'Mbuguni', 'Ngabobo', 'Ngarenanyuki', 'Nkoanekoli',
    'Nkoanrua', 'Nkoaranga', 'Nkoarisambu', 'Poli', 'Seela Sing\'isi', 'Shambarai Burka', 'Songoro',
    'Usa River', 'Uwiro'
  ],
  'Karatu': [
    'Baray', 'Buger', 'Daa', 'Endabash', 'Endamaghang', 'Endamarariek', 'Ganako', 'Kansay', 'Karatu',
    'Mang\'ola', 'Mbulumbulu', 'Oldeani', 'Qurus', 'Rhotia'
  ],
  'Longido': [
    'Eleng\'ata Dapash', 'Engarenaibor', 'Engikaret', 'Gelai Lumbwa', 'Gelai Meirugoi', 'Ilorienito',
    'Kamwanga', 'Kimokouwa', 'Kitumbeine', 'Longido', 'Matale', 'Mundarara', 'Namanga', 'Noondoto',
    'Olmolog', 'Orbomba', 'Sinya', 'Tingatinga'
  ],
  'Monduli': [
    'Engaruka', 'Engutoto', 'Esilalei', 'Lashaine', 'Lemooti', 'Lepurko', 'Lolkisale', 'Majengo',
    'Makuyuni', 'Meserani', 'Mfereji', 'Migungani', 'Moita', 'Monduli Juu', 'Monduli Mjini', 'Mswakini',
    'Mto wa Mbu', 'Naalarami', 'Selela', 'Sepeko'
  ],
  'Ngorongoro': [
    'Alailelai', 'Alaitolei', 'Arash', 'Digodigo', 'Enduleni', 'Engaresero', 'Enguserosambu', 'Eyasi',
    'Kakesio', 'Kirangi', 'Maalon', 'Malambo', 'Misigiyo', 'Nainokanoka', 'Naiyobi', 'Ngoile', 'Ngorongoro',
    'Olbalbal', 'Oldonyo-Sambu', 'Oloipiri', 'Oloirien', 'Ololosokwan', 'Orgosorok', 'Pinyinyi', 'Piyaya',
    'Sale', 'Samunge', 'Soit-Sambu'
  ],
  'Dodoma Urban': [
    'Chahwa', 'Chamwino', 'Chang\'ombe', 'Chigongwe', 'Chihanga', 'Dodoma Makulu', 'Hazina', 'Hombolo Bwawani',
    'Hombolo Makulu', 'Ihumwa', 'Ipagala', 'Ipala', 'Iyumbu', 'Kikombo', 'Kikuyu Kaskazini', 'Kikuyu Kusini',
    'Kilimani', 'Kiwanja cha Ndege', 'Kizota', 'Madukani', 'Majengo', 'Makole', 'Makutupora', 'Matumbulu',
    'Mbabala', 'Mbalawala', 'Miyuji', 'Mkonze', 'Mnadani', 'Mpunguzi', 'Msalato', 'Mtumba', 'Nala',
    'Ng\'hong\'honha', 'Nkuhungu', 'Ntyuka', 'Nzuguni', 'Tambukareli', 'Uhuru', 'Viwandani', 'Zuzu'
  ],
  'Dodoma Rural': [
    'Buigiri', 'Chamwino', 'Chiboli', 'Chilonwa', 'Chinugulu', 'Dabalo', 'Fufu', 'Handali', 'Haneti', 'Huzi',
    'Idifu', 'Igandu', 'Ikombolinga', 'Ikowa', 'Iringa Mvumi Zamani', 'Itiso', 'Loje', 'Majeleko', 'Makang\'wa',
    'Manchali', 'Manda', 'Manzase', 'Membe', 'Mlowa Barabarani', 'Mlowa Bwawani', 'Mpwayungu', 'Msamalo',
    'Msanga', 'Muungano', 'Mvumi Makulu', 'Mvumi Mission', 'Nghahelezi', 'Nghambaku', 'Nhinhi', 'Segala', 'Zajilwa'
  ],
  'Kondoa': [
    'Bereko', 'Bumbuta', 'Busi', 'Changaa', 'Haubi', 'Hondomairo', 'Itaswi', 'Itololo', 'Kalamba', 'Keikei',
    'Kikilo', 'Kikore', 'Kinyasi', 'Kisese', 'Kwadelo', 'Masange', 'Mnenia', 'Pahi', 'Salanka', 'Soera', 'Thawi'
  ],
  'Mpwapwa': [
    'Berege', 'Chipogoro', 'Chitemo', 'Chunyu', 'Galigali', 'Godegode', 'Gulwe', 'Ipera', 'Iwondo', 'Kibakwe',
    'Kimagai', 'Kingiti', 'Lufu', 'Luhundwa', 'Lumuma', 'Lupeta', 'Malolo', 'Mang\'aliza', 'Massa', 'Matomondo',
    'Mazae', 'Mbuga', 'Mima', 'Mlembule', 'Mlunduzi', 'Mpwapwa Mjini', 'Mtera', 'Nghambi', 'Pwaga', 'Rudi',
    'Ving\'hawe', 'Wangi', 'Wotta'
  ],
  'Kongwa': [
    'Chamkoroma', 'Chitego', 'Chiwe', 'Hogoro', 'Iduo', 'Kibaigwa', 'Kongwa', 'Lenjulu', 'Makawa', 'Matongoro',
    'Mkoka', 'Mlali', 'Mtanana', 'Nghumbi', 'Ngomai', 'Njoge', 'Pandambili', 'Sagara', 'Sejeli', 'Songambele',
    'Ugogoni', 'Zoissa'
  ],
  'Chemba': [
    'Babayu', 'Chandama', 'Chemba', 'Churuku', 'Dalai', 'Farkwa', 'Goima', 'Gwandi', 'Jangalo', 'Kidoka',
    'Kimaha', 'Kinyamsindo', 'Kwamtoro', 'Lahoda', 'Lalta', 'Makorongo', 'Mondo', 'Mpendo', 'Mrijo', 'Msaada',
    'Ovada', 'Paranga', 'Sanzawa', 'Songoro', 'Soya', 'Tumbakose'
  ],
  'Mbeya City': [
    'Forest', 'Ghana', 'Iduda', 'Iganjo', 'Iganzo', 'Igawilo', 'Ilemi', 'Ilomba', 'Isanga', 'Isyesye',
    'Itagano', 'Itende', 'Itezi', 'Itiji', 'Iwambi', 'Iyela', 'Iyunga', 'Iziwa', 'Kalobe', 'Maanga', 'Mabatini',
    'Maendeleo', 'Majengo', 'Mbalizi Road', 'Mwakibete', 'Mwansekwa', 'Mwasanga', 'Nonde', 'Nsalaga', 'Nsoho',
    'Nzovwe', 'Ruanda', 'Sinde', 'Sisimba', 'Tembela', 'Uyole'
  ],
  'Mbeya DC': [
    'Bonde la Songwe', 'Igale', 'Igoma', 'Ihango', 'Ijombe', 'Ikukwa', 'Ilembo', 'Ilungu', 'Inyala', 'Isuto',
    'Itawa', 'Itewe', 'Iwiji', 'Iwindi', 'Iyunga Mapinduzi', 'Izyra', 'Lwanjiro', 'Maendeleo', 'Masoko', 'Mjele',
    'Mshewe', 'Nsalala', 'Santilya', 'Shizuvi', 'Swaya', 'Tembela', 'Ulenje', 'Utengule Usongwe'
  ],
  'Chunya': [
    'Bwawani', 'Chalangwa', 'Chokaa', 'Ifumbo', 'Itewe', 'Kambikatoto', 'Kasanga', 'Lupa Tingatinga', 'Luwalaje',
    'Mafyeko', 'Makongorosi', 'Mamba', 'Matundasi', 'Matwiga', 'Mbugani', 'Mkola', 'Mtanila', 'Nkung\'ungu',
    'Sangambi', 'Upendo'
  ],
  'Kyela': [
    'Bondeni', 'Bujonde', 'Busale', 'Ibanda', 'Ikama', 'Ikimba', 'Ikolo', 'Ipande', 'Ipinda', 'Ipyana',
    'Itope', 'Itunge', 'Kajunjumele', 'Katumba Songwe', 'Kyela', 'Lusungo', 'Mababu', 'Makwale', 'Matema',
    'Mbugani', 'Mikoroshoni', 'Muungano', 'Mwanganyanga', 'Mwaya', 'Ndandalo', 'Ndobo', 'Ngana', 'Ngonga',
    'Njisi', 'Nkokwa', 'Nkuyu', 'Serengeti', 'Talatala'
  ],
  'Mbozi': [
    'Bara', 'Halungu', 'Hasamba', 'Hasanga', 'Hezya', 'Ichenjezya', 'Idiwili', 'Igamba', 'Ihanda', 'Ilolo',
    'Ipunga', 'Isalalo', 'Isansa', 'Itaka', 'Itumpi', 'Iyula', 'Kilimampimbi', 'Magamba', 'Mahenje', 'Mlangali',
    'Mlowo', 'Msia', 'Nambinzo', 'Nanyala', 'Nyimbili', 'Ruanda', 'Shiwinga', 'Ukwile', 'Vwawa'
  ],
  'Rungwe': [
    'Bagamoyo Ward', 'Bujela', 'Bulyaga', 'Ibighi', 'Ikama', 'Ikuti', 'Ilima', 'Iponjela', 'Isongole', 'Itagata',
    'Kawetele', 'Kikole', 'Kinyala', 'Kisiba', 'Kisondela', 'Kiwira', 'Kyimo', 'Lufingo', 'Lupepo', 'Makandana',
    'Malindo', 'Masebe', 'Masoko', 'Masukulu', 'Matwebe', 'Mpuguso', 'Msasani Ward', 'Ndato', 'Nkunga', 'Suma', 'Swaya'
  ],
  'Kibaha': [
    'Bokomnemela', 'Dutumi', 'Gwata', 'Janga', 'Kawawa', 'Kikongo', 'Kilangalanga', 'Kwala', 'Magindu', 'Mlandizi',
    'Mtambani', 'Mtongani', 'Ruvu', 'Soga'
  ],
  'Bagamoyo': [
    'Dunda', 'Fukayosi', 'Kerege', 'Kiromo', 'Kisutu', 'Magomeni', 'Makurunge', 'Mapinga', 'Nianjema', 'Yombo', 'Zinga'
  ],
  'Kisarawe': [
    'Boga', 'Cholesamvula', 'Kazimzumbwi', 'Kibuta', 'Kiluvya', 'Kisarawe', 'Kurui', 'Mafizi', 'Maneromango', 'Marui',
    'Marumbo', 'Masaki', 'Msanga', 'Msimbu', 'Mzenga', 'Vihingo', 'Vikumbulu'
  ],
  'Rufiji': [
    'Chemchem', 'Chumbi', 'Ikwiriri', 'Kipugira', 'Mbwara', 'Mgomba', 'Mkongo', 'Mohoro', 'Mwaseni', 'Ngarambe',
    'Ngorongo', 'Umwe', 'Utete'
  ],
  'Mkuranga': [
    'Beta', 'Bupu', 'Dondo', 'Kimanzichana', 'Kiparang\'anda', 'Kisegese', 'Kisiju', 'Kitomondo', 'Lukanga', 'Magawa',
    'Mbezi', 'Mipeko', 'Mkamba', 'Mkuranga', 'Msonga', 'Mwalusembe', 'Mwandege', 'Njia Nne', 'Nyamato', 'Panzuo',
    'Shungubweni', 'Tambani', 'Tengelea', 'Vianzi', 'Vikindu'
  ],
  'Mafia': [
    'Baleni', 'Jibondo', 'Kanga', 'Kiegeani', 'Kilindoni', 'Kirongwe', 'Miburani', 'Ndagoni'
  ],
  'Kibiti': [
    'Bungu', 'Dimani', 'Kibiti', 'Kiongoroni', 'Mahege', 'Maparoni', 'Mbuchi', 'Mchukwi', 'Mjawa', 'Mlanzi',
    'Msala', 'Mtawanya', 'Mtunda', 'Mwambao', 'Ruaruke', 'Salale'
  ],
  'Morogoro Urban': [
    'Bigwa', 'Boma', 'Chamwino', 'Kauzeni', 'Kichangani', 'Kihonda', 'Kihonda Maghorofani', 'Kilakala', 'Kingo',
    'Kingolwira', 'Kiwanja cha Ndege', 'Luhungo', 'Lukobe', 'Mafiga', 'Mafisa', 'Magadu', 'Mazimbu', 'Mbuyuni',
    'Mindu', 'Mji Mkuu', 'Mji Mpya', 'Mkundi', 'Mlimani', 'Mwembesongo', 'Mzinga', 'Sabasaba', 'Sultan Area',
    'Tungi', 'Uwanja wa Taifa'
  ],
  'Morogoro Rural': [
    'Bungu', 'Bwakila Chini', 'Bwakila Juu', 'Gwata', 'Kasanga', 'Kibogwa', 'Kibuko', 'Kibungo Juu', 'Kidugalo',
    'Kinole', 'Kiroka', 'Kisaki', 'Kisemu', 'Kolero', 'Konde', 'Lundi', 'Matuli', 'Mikese', 'Mkambarani', 'Mkulazi',
    'Mkuyuni', 'Mngazi', 'Mtombozi', 'Mvuha', 'Ngerengere', 'Selembala', 'Singisa', 'Tawa', 'Tegetero', 'Tomondo',
    'Tununguo'
  ],
  'Kilosa': [
    'Berega', 'Chanzulu', 'Dumila', 'Kasiki', 'Kidete', 'Kidodi', 'Kilangali', 'Kimamba A', 'Kimamba B', 'Kisanga',
    'Kitete', 'Lumbiji', 'Lumuma', 'Mabula', 'Mabwerebwere', 'Madoto', 'Magole', 'Magomeni', 'Magubike', 'Maguha',
    'Malolo', 'Mamboya', 'Masanze', 'Mbigiri', 'Mbumi', 'Mhenda', 'Mikumi', 'Mkwatani', 'Msowero', 'Mtumbatu',
    'Mvumi', 'Parakuyo', 'Ruaha', 'Rudewa', 'Ruhembe', 'Tindiga', 'Ulaya', 'Uleling\'ombe', 'Vidunda', 'Zombo'
  ],
  'Gairo': [
    'Chagongwe', 'Chakwale', 'Chanjale', 'Chigela', 'Gairo', 'Idibo', 'Italagwe', 'Iyogwe', 'Kibedya', 'Leshata',
    'Madege', 'Magoweko', 'Mandege', 'Mkalama', 'Msingisi', 'Nongwe', 'Rubeho', 'Ukwamani'
  ],
  'Kilombero': [
    'Chisano', 'Chita', 'Idete', 'Ifakara', 'Kibaoni', 'Mang\'ula B', 'Katindiuka', 'Namwawala', 'Ching\'anda',
    'Kiberege', 'Kidatu', 'Kisawasawa', 'Lumemo', 'Mang\'ula', 'Mwaya', 'Mngeta', 'Kalengakelo', 'Masagati', 'Mbingu',
    'Mchombe', 'Mkula', 'Signal', 'Viwanja Sitini', 'Igima', 'Kamwene', 'Mofu', 'Sanje', 'Uchindile', 'Utengule',
    'Msolwa Station', 'Michenga', 'Lipangalala', 'Mbasa'
  ],
  'Ulanga': [
    'Chirombola', 'Euga', 'Ilonga', 'Iragua', 'Isongo', 'Ketaketa', 'Kichangani', 'Lukande', 'Lupiro', 'Mahenge',
    'Mawasiliano', 'Mbuga', 'Milola', 'Minepa', 'Msogezi', 'Mwaya', 'Nawenge', 'Ruaha', 'Sali', 'Uponera', 'Vigoi'
  ],
  'Mvomero': [
    'Bunduki', 'Dakawa', 'Diongoya', 'Doma', 'Hembeti', 'Homboza', 'Kanga', 'Kibati', 'Kikeo', 'Kinda', 'Kweuma',
    'Langali', 'Luale', 'Lubungo', 'Mangae', 'Maskati', 'Melela', 'Mgeta', 'Mhonda', 'Mkindo', 'Mlali', 'Msongozi',
    'Mtibwa', 'Mvomero', 'Mziha', 'Mzumbe', 'Nyandira', 'Pemba', 'Sungaji', 'Tchenzema'
  ],
  'Iringa Urban': [
    'Gangilonga', 'Igumbilo', 'Ipogolo', 'Ilala', 'Isakalilo', 'Kihesa', 'Kitanzini', 'Kitwiru', 'Kwakilosa',
    'Makorongoni', 'Mivinjeni', 'Mkwawa', 'Mlandege', 'Mshindo', 'Mtwivila', 'Mwangata', 'Nduli', 'Ruaha'
  ],
  'Iringa Rural': [
    'Idodi', 'Ifunda', 'Ilolo Mpya', 'Itunundu', 'Izazi', 'Kalenga', 'Kihanga', 'Kihorogota', 'Kising\'a', 'Kiwere',
    'Luhota', 'Lumuli', 'Lyamgungwe', 'Maboga', 'Maguliwa', 'Mahuninga', 'Malengamakali', 'Masaka', 'Mboliboli', 'Mgama',
    'Migoli', 'Mlenge', 'Mlowa', 'Mseke', 'Nyang\'oro', 'Nzihi', 'Ulanda', 'Wasa'
  ],
  'Kilolo': [
    'Bomalang\'ombe', 'Dabaga', 'Ibumu', 'Idete', 'Ihimbo', 'Ilula', 'Image', 'Irole', 'Kising\'a', 'Kimala', 'Kitowo',
    'Lugalo', 'Mahenge', 'Masisiwe', 'Mawambala', 'Mlafu', 'Mtitu', 'Ng\'ang\'ange', 'Ng\'uruhe', 'Nyalumbu', 'Nyanzwa',
    'Ruaha Mbuyuni', 'Udekwa', 'Uhambingeto', 'Ukumbi', 'Ukwega', 'Winome'
  ],
  'Mufindi': [
    'Bumilayinga', 'Ifunda', 'Ifwagi', 'Igombavanu', 'Igowole', 'Ihalimba', 'Ihanu', 'Ihowanza', 'Ikweha', 'Isalavanu',
    'Itandula', 'Kasanga', 'Kibengu', 'Kiyowela', 'Luhunga', 'Mafinga', 'Makungu', 'Malangali', 'Mapanda', 'Mbalamaziwa',
    'Mdabulo', 'Mninga', 'Mpanga TAZARA', 'Mtambula', 'Mtwango', 'Nyololo', 'Rungemba', 'Sadani'
  ],
  'Makete': [
    'Bulongwa', 'Luwumbu', 'Kipagalo', 'Iniho', 'Ipelele', 'Kigulu', 'Matamba', 'Mlondwa', 'Kitulo', 'Itundu',
    'Ikuwo', 'Mfumbi', 'Kigala', 'Lupila', 'Ukwama', 'Mbalatse', 'Ipepo', 'Lupalilo', 'Tandala', 'Mang\'oto', 'Iwawa', 'Isapulano'
  ],
  'Ludewa': [
    'Ibumi', 'Iwela', 'Kilondo', 'Lifuma', 'Luana', 'Lubonde', 'Ludende', 'Ludewa', 'Lugarawa', 'Luilo', 'Lumbila',
    'Lupanga', 'Lupingu', 'Madilu', 'Madope', 'Makonde', 'Manda', 'Masasi', 'Mavanga', 'Mawengi', 'Milo'
  ],
  'Moshi Urban': [
    'Boma Mbuzi', 'Bondeni', 'Kaloleni', 'Karanga', 'Kiboriloni', 'Kilimanjaro', 'Kiusa', 'Korongoni', 'Longuo B',
    'Majengo', 'Mawenzi', 'Mfumuni', 'Miembeni', 'Mji Mpya', 'Msaranga', 'Ng\'ambo', 'Njoro', 'Pasua', 'Rau',
    'Shirimatunda', 'Soweto'
  ],
  'Moshi Rural': [
    'Arusha Chini', 'Kahe', 'Kahe Mashariki', 'Kibosho Kati', 'Kibosho Magharibi', 'Kibosho Mashariki',
    'Kilema Kaskazini', 'Kilema Kati', 'Kilema Kusini', 'Kimochi', 'Kindi', 'Kirima', 'Kirua Vunjo Kusini',
    'Kirua Vunjo Magharibi', 'Kirua Vunjo Mashariki', 'Mabogini', 'Makuyuni', 'Mamba Kaskazini', 'Mamba Kusini',
    'Marangu Magharibi', 'Marangu Mashariki', 'Mbokomu', 'Mwika Kaskazini', 'Mwika Kusini', 'Njia Panda',
    'Okaoni', 'Old Moshi Magharibi', 'Old Moshi Mashariki', 'Uru Kaskazini', 'Uru Kusini', 'Uru Mashariki', 'Uru Shimbwe'
  ],
  'Hai': [
    'Bomang\'ombe', 'Bondeni', 'KIA', 'Machame Kaskazini', 'Machame Magharibi', 'Machame Mashariki', 'Machame Narumu',
    'Machame Uroki', 'Machame Weruweru', 'Masama Kati', 'Masama Kusini', 'Masama Magharibi', 'Masama Mashariki',
    'Masama Rundugai', 'Mnadani', 'Muungano', 'Romu'
  ],
  'Rombo': [
    'Chala', 'Holili', 'Katangara Mrere', 'Kelamfua Mokala', 'Keni Aleni', 'Keni Mengeni', 'Kirongo Samanga',
    'Kirwa Keni', 'Kisale Masangara', 'Kitirima', 'Kitirima Kingachi', 'Mahida', 'Makiidi', 'Mamsera', 'Manda',
    'Marangu Kitowo', 'Mengwe', 'Motamburu Kitendeni', 'Mrao Keryo', 'Nanjala', 'Ngoyoni', 'Olele', 'Reha',
    'Shimbi', 'Shimbi Kwandele', 'Tarakea Motamburu', 'Ubetu Kahe', 'Ushiri Ikuini'
  ],
  'Same': [
    'Bangalala', 'Bendera', 'Bombo', 'Bwambo', 'Chome', 'Gavao-Saweni', 'Hedaru', 'Kalemawe', 'Kihurio', 'Kirangare',
    'Kisima', 'Kisiwani', 'Lugulu', 'Mabilioni', 'Makanya', 'Maore', 'Mhezi', 'Mpinji', 'Mshewa', 'Msindo', 'Mtii',
    'Mwembe', 'Myamba', 'Ndungu', 'Njoro', 'Ruvu', 'Same', 'Stesheni', 'Suji', 'Tae', 'Vudee', 'Vuje', 'Vumari', 'Vunta'
  ],
  'Mwanga': [
    'Chomvu', 'Jipe', 'Kifula', 'Kighare', 'Kigonigoni', 'Kileo', 'Kilomeni', 'Kirongwe', 'Kirya', 'Kivisini',
    'Kwakoa', 'Lang\'ata', 'Lembeni', 'Mgagao', 'Msangeni', 'Mwanga', 'Mwaniko', 'Ngujini', 'Shighatini', 'Toloha'
  ],
  'Ilemela': [
    'Bugogwa', 'Buswelu', 'Buzuruga', 'Ibungilo', 'Ilemela', 'Kahama', 'Kawekamo', 'Kayenze', 'Kirumba', 'Kiseke',
    'Kitangiri', 'Mecco', 'Nyakato', 'Nyamanoro', 'Nyamhongolo', 'Nyasaka', 'Pasiansi', 'Sangabuye', 'Shibula'
  ],
  'Nyamagana': [
    'Buhongwa', 'Butimba', 'Igogo', 'Igoma', 'Isamilo', 'Kishili', 'Luchelele', 'Lwanhima', 'Mabatini', 'Mahina',
    'Mbugani', 'Mhandu', 'Mirongo', 'Mkolani', 'Mikuyuni', 'Nyamagana', 'Nyegezi', 'Pamba'
  ],
  'Magu': [
    'Buhumbi', 'Bujashi', 'Bujora', 'Bukandwe', 'Chabula', 'Isandula', 'Itumbili', 'Jinjimili', 'Kabila', 'Kahangara',
    'Kandawe', 'Kisesa', 'Kitongo Sima', 'Kongolo', 'Lubugu', 'Lutale', 'Magu Mjini', 'Mwamabanza', 'Mwamanga',
    'Ng\'haya', 'Nkungulu', 'Nyanguge', 'Nyigogo', 'Shishani', 'Sukuma'
  ],
  'Sengerema': [
    'Bitoto', 'Busisi', 'Buyagu', 'Buzilasoga', 'Chifunfu', 'Ibisabageni', 'Ibondo', 'Igalula', 'Igulumuki', 'Kagunga',
    'Kahumulo', 'Kasenyi', 'Kasungamile', 'Katunguru', 'Kishinda', 'Mission', 'Mwabaluhi', 'Ngoma', 'Nyamatongo',
    'Nyamazugo', 'Nyamizeze', 'Nyampande', 'Nyampulukano', 'Nyatukala', 'Sima', 'Tabaruka'
  ],
  'Ukerewe': [
    'Bukanda', 'Bukiko', 'Bukindo', 'Bukongo', 'Bukungu', 'Bwiro', 'Bwisya', 'Igalla', 'Ilangala', 'Irugwa',
    'Kagera', 'Kagunguli', 'Kakerege', 'Kakukuru', 'Mukituntu', 'Muriti', 'Murutunguru', 'Nakatunguru', 'Namagondo',
    'Namilembe', 'Nansio', 'Nduruma', 'Ngoma', 'Nkilizya', 'Nyamanga'
  ],
  'Misungwi': [
    'Buhingo', 'Buhunda', 'Bulemeji', 'Busongo', 'Fella', 'Gulumungu', 'Idetemya', 'Igokelo', 'Ilujamate', 'Isenengeja',
    'Kanyelele', 'Kasololo', 'Kijima', 'Koromije', 'Lubili', 'Mabuki', 'Mamaye', 'Mbarika', 'Misasi', 'Misungwi',
    'Mondo', 'Mwaniko', 'Nhundulu', 'Shilalo', 'Sumbugu', 'Ukiriguru', 'Usagara'
  ],
  'Tanga City': [
    'Central', 'Chongoleani', 'Chumbageni', 'Duga', 'Kiomoni', 'Kirare', 'Mabawa', 'Mabokweni', 'Magaoni', 'Majengo',
    'Makorora', 'Marungu', 'Masiwani', 'Maweni', 'Mnyanjani', 'Msambweni', 'Mwanzange', 'Mzingani', 'Mzizima',
    'Ngamiani Kaskazini', 'Ngamiani Kati', 'Ngamiani Kusini', 'Nguvumali', 'Pongwe', 'Tangasisi', 'Tongoni', 'Usagara'
  ],
  'Musoma Urban': [
    'Buhare', 'Bweri', 'Iringo', 'Kamunyonge', 'Kigera', 'Kitaji', 'Makoko', 'Mukendo', 'Mwigobero', 'Mwisenge',
    'Nyakato', 'Nyamatare', 'Nyasho'
  ],
  'Musoma Rural': [
    'Bugoji', 'Ifulifu', 'Musanja', 'Bugwema', 'Bukima', 'Bukumi', 'Bulinga', 'Busambara', 'Bwasi', 'Kiriba',
    'Makojo', 'Mugango', 'Murangi', 'Nyambono', 'Nyamrandirira', 'Suguti', 'Tegeruka'
  ],
  'Tarime': [
    'Binagi', 'Bomani', 'Bumera', 'Genyange', 'Gorong\'a', 'Itiryo', 'Kemambo', 'Kentare', 'Kibasuka', 'Kiore',
    'Komaswa', 'Manga', 'Matongo', 'Mbogi', 'Muriba', 'Mwema', 'Nyakonga', 'Gwitiryo', 'Nyamisangura', 'Nyamwaga',
    'Nyangoto', 'Nyamongo', 'Nyansicha', 'Nyanungu', 'Nyarero', 'Nyarokoba', 'Nyabichune', 'Mjini Kati', 'Pemba',
    'Sabasaba', 'Sirari', 'Susuni', 'Turwa'
  ],
  'Serengeti': [
    'Busawe', 'Geitasamo', 'Ikoma', 'Issenye', 'Kebanchabancha', 'Kenyamonta', 'Kisaka', 'Kisangura', 'Kyambahi',
    'Machochwe', 'Magange', 'Majimoto', 'Manchira', 'Mbalibali', 'Morotonga', 'Mosongo', 'Mugumu', 'Natta',
    'Nyamatare', 'Nyambureti', 'Nyamoko', 'Nyansurura', 'Rigicha', 'Ring\'wani', 'Rung\'abure', 'Sedeco', 'Stendi Kuu', 'Uwanja wa Ndege'
  ],
  'Bunda': [
    'Butimba', 'Chitengule', 'Hunyari', 'Igundu', 'Iramba', 'Kasuguti', 'Ketare', 'Kibara', 'Kisorya', 'Mihingo',
    'Mugeta', 'Namhula', 'Nampindi', 'Nansimo', 'Neruma', 'Nyamang\'uta', 'Nyamihyoro', 'Nyamuswa', 'Salama'
  ],
  'Butiama': [
    'Bisumwa', 'Buhemba', 'Bukabwa', 'Buruma', 'Busegwe', 'Bumangi', 'Buswahili', 'Butiama', 'Butuguri', 'Bwiregi',
    'Etaro', 'Kukirango', 'Kyanyari', 'Masaba', 'Mirwa', 'Muriaza', 'Nyakatende', 'Nyamimange', 'Nyankanga', 'Nyegina', 'Sirorisimba'
  ],
  'Rorya': [
    'Kigunga', 'Kirogo', 'Nyamtinga', 'Nyamagaro', 'Nyahongo', 'Mkoma', 'Tai', 'Bukura', 'Roche', 'Kitembe',
    'Mirare', 'Goribe', 'Ikoma', 'Koryo', 'Bukwe', 'Nyathorogo', 'Rabour', 'Kisumwa', 'Komuge', 'Nyamunga', 'Kyang\'ombe'
  ],
  'Bukoba Rural': [
    'Buhendangabo', 'Bujugo', 'Butelankuzi', 'Butulage', 'Ibwera', 'Izimbya', 'Kaagya', 'Kaibanja', 'Kanyangereko',
    'Karabagaine', 'Kasharu', 'Katerero', 'Katoma', 'Katoro', 'Kemondo', 'Kibirizi', 'Kikomero', 'Kishanje', 'Kishogo',
    'Kyamulaile', 'Maruku', 'Mikoni', 'Mugajwale', 'Nyakato', 'Nyakibimbili', 'Rubafu', 'Rubale', 'Ruhunga', 'Rukoma'
  ],
  'Muleba': ['Bugabo', 'Buhangaza', 'Bunena', 'Bushangwe', 'Bwera', 'Ibuga', 'Izigo', 'Kasharazi', 'Katerero', 'Kitobo', 'Kyaka', 'Lyamutongo', 'Muleba', 'Murutunguru', 'Ngenge', 'Ngara', 'Ruhija', 'Rukoma', 'Rutunguru', 'Rwabwere', 'Rwamishenye', 'Rwanyambo', 'Rwiba', 'Rwinyanga'],
  'Karagwe': ['Biharu', 'Bugarama', 'Bugene', 'Bweranyange', 'Ihembe', 'Ishunju', 'Kabululu', 'Kagera', 'Kamuli', 'Kanoni', 'Kayanga', 'Kemondo', 'Kibondo', 'Kituntu', 'Kyaka', 'Nyakahanga', 'Nyakasimbi', 'Nyakabanga', 'Rugenge', 'Rugu'],
  'Biharamulo': ['Biharamulo', 'Bisya', 'Buhoro', 'Bunambiyu', 'Bushasha', 'Gera', 'Kabanga', 'Kanyigo', 'Kasharu', 'Katoma', 'Kibondo', 'Kikomero', 'Kimwani', 'Kiruruma', 'Kitwe', 'Muganza', 'Murutunguru', 'Ngara', 'Ngenge', 'Nyakahanga', 'Ruhita', 'Rukoma'],
  'Ngara': [
    'Bukiriro', 'Bugarama', 'Kabanga', 'Kanazi', 'Kasulo', 'Keza', 'Kibimba', 'Kirushya', 'Mabawe', 'Mbuba',
    'Muganza', 'Mugoma', 'Murukulazo', 'Murusagamba', 'Ngara Mjini', 'Ntobeye', 'Nyakisasa', 'Nyamiyaga', 'Rulenge', 'Rusumo'
  ],
  'Kyerwa': [
    'Bugomora', 'Businde', 'Isingiro', 'Kaisho', 'Kamuli', 'Kibale', 'Kibingo', 'Kikukuru', 'Kimuli', 'Kyerwa',
    'Mabira', 'Murongo', 'Nkwenda', 'Nyakatuntu', 'Rukuraijo', 'Rutunguru', 'Rwabwere', 'Songambele', 'Kitwechenkura'
  ],
  'Wete': ['Bopwe', 'Fundo', 'Gando', 'Kangagani', 'Kibabamu', 'Kichokochwe', 'Kiuyu', 'Konde', 'Mchangani', 'Michenzani', 'Mkanyageni', 'Mtambwe', 'Ngombeni', 'Pandani', 'Shenge', 'Utaani', 'Wete'],
  'Micheweni': ['Chambani', 'Dodo', 'Kibokoni', 'Kisiwani', 'Kiwani', 'Micheweni', 'Mkuku', 'Ng\'ambwa', 'Tondooni', 'Tumbe', 'Utaani'],
  'Konde': ['Chambani', 'Dodo', 'Kibokoni', 'Kisiwani', 'Kiwani', 'Micheweni', 'Mkuku', 'Ng\'ambwa', 'Tondooni', 'Tumbe', 'Utaani'],
  'Chake Chake': ['Chake Chake', 'Chambani', 'Dodo', 'Kibokoni', 'Kisiwani', 'Kiwani', 'Micheweni', 'Mkuku', 'Ng\'ambwa', 'Tondooni', 'Tumbe', 'Utaani'],
  'Mkoani': ['Chambani', 'Dodo', 'Kibokoni', 'Kisiwani', 'Kiwani', 'Micheweni', 'Mkuku', 'Ng\'ambwa', 'Tondooni', 'Tumbe', 'Utaani'],
  'Wawi': ['Chambani', 'Dodo', 'Kibokoni', 'Kisiwani', 'Kiwani', 'Micheweni', 'Mkuku', 'Ng\'ambwa', 'Tondooni', 'Tumbe', 'Utaani'],
  'Magharibi': ['Dole', 'Dimani', 'Fuoni', 'Kibeni', 'Kikobweni', 'Magogoni', 'Mazizini', 'Mfenesini', 'Mtoni', 'Mwakaje', 'Mwembetanga', 'Nyerere', 'Pangawe', 'Shakani', 'Uzini', 'Zanzibar'],
  'Mjini': ['Malindi', 'Mchangani', 'Mkele', 'Mwembeshauri', 'Nyerere', 'Shangani', 'Stone Town'],
  'Kaskazini A': ['Bumbwini', 'Donge', 'Donge Mbiji', 'Fukuchani', 'Gando', 'Kibeni', 'Kijiji', 'Kiwanda', 'Mabigeni', 'Magomeni', 'Makoba', 'Mangapwani', 'Matemwe', 'Mvuleni', 'Nungwi', 'Tazari', 'Upenja'],
  'Kaskazini B': ['Bumbwini', 'Donge', 'Fukuchani', 'Gando', 'Kibeni', 'Kijiji', 'Kiwanda', 'Mabigeni', 'Magomeni', 'Makoba', 'Mangapwani', 'Matemwe', 'Mvuleni', 'Nungwi', 'Tazari', 'Upenja'],
  'Kusini': ['Bwejuu', 'Jambiani', 'Kizimkazi', 'Makunduchi', 'Paje', 'Unguja'],
  'Kati': ['Chwaka', 'Dunga', 'Fuoni', 'Kibele', 'Kiongoni', 'Kizimkazi', 'Mangapwani', 'Michenzani', 'Mwera', 'Nganani', 'Pembeni', 'Uroa', 'Wingwi'],
  'Bukoba Urban': ['Kashai', 'Nyegezi', 'Nyakato', 'Bugando', 'Hamugembe'],
}

/** If no ward list exists for district, return district name as single option */
export function getWardOptions(district: string): string[] {
  const wards = WARDS_BY_DISTRICT[district]
  if (wards && wards.length > 0) return wards
  return [district]
}
