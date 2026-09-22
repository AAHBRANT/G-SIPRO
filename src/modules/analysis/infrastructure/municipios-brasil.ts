/**
 * Municípios brasileiros com código do IBGE e coordenada da sede.
 *
 * Fonte: https://github.com/kelvins/municipios-brasileiros (licença MIT,
 * reproduzida abaixo), obtida em 22/09/2026 — a mesma base que o handoff da
 * Análise indica.
 *
 * ⚠️ FICA SÓ NO SERVIDOR. São 5.570 linhas: mandar isto para o navegador
 * seria um quarto de megabyte por abertura de tela para usar algumas dezenas
 * de municípios. O servidor resolve a coordenada dos municípios que têm
 * licitação e manda só esses. Nenhum componente de cliente importa este
 * arquivo.
 *
 * ⚠️ A COORDENADA É DA SEDE DO MUNICÍPIO, e o município é o da unidade do
 * órgão que publicou — não o endereço da obra. Ver `territorio.ts`.
 *
 * ⚠️ O casamento é por NOME NORMALIZADO + UF: o PNCP manda o nome do
 * município, nunca o código do IBGE. Nome sem acento, sem caixa e sem
 * pontuação; o par nome+UF é único (homônimo só existe entre UFs diferentes,
 * e o gerador falha se algum dia deixar de ser verdade). Município que não
 * casar não ganha ponto no mapa e continua contando em todos os totais.
 *
 * MIT License · Copyright (c) 2016 Kelvin S. do Prado
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

export type MunicipioBrasileiro = Readonly<{
  ibge: number;
  /** Nome normalizado: sem acento, sem caixa, sem pontuação. */
  chave: string;
  uf: string;
  latitude: number;
  longitude: number;
}>;

/** Uma linha por município: `ibge|nome normalizado|UF|latitude|longitude`. */
const TABELA = `
5200050|abadia de goias|GO|-16.7573|-49.4412
3100104|abadia dos dourados|MG|-18.4831|-47.3916
5200100|abadiania|GO|-16.197|-48.7057
3100203|abaete|MG|-19.1551|-45.4444
1500107|abaetetuba|PA|-1.72183|-48.8788
2300101|abaiara|CE|-7.34588|-39.0416
2900108|abaira|BA|-13.2488|-41.6619
2900207|abare|BA|-8.72073|-39.1162
4100103|abatia|PR|-23.3049|-50.3133
4200051|abdon batista|SC|-27.6126|-51.0233
1500131|abel figueiredo|PA|-4.95333|-48.3933
4200101|abelardo luz|SC|-26.5716|-52.3229
3100302|abre campo|MG|-20.2996|-42.4743
2600054|abreu e lima|PE|-7.90072|-34.8984
1700251|abreulandia|TO|-9.62101|-49.1518
3100401|acaiaca|MG|-20.359|-43.1439
2100055|acailandia|MA|-4.94714|-47.5004
2900306|acajutiba|BA|-11.6575|-38.0197
1500206|acara|PA|-1.95383|-48.1985
2300150|acarape|CE|-4.22083|-38.7055
2300200|acarau|CE|-2.88769|-40.1183
2400109|acari|RN|-6.4282|-36.6347
2200053|acaua|PI|-8.21954|-41.0831
4300034|acegua|RS|-31.8665|-54.1615
2300309|acopiara|CE|-6.08911|-39.448
5100102|acorizal|MT|-15.194|-56.3632
1200013|acrelandia|AC|-9.82581|-66.8972
5200134|acreuna|GO|-17.396|-50.3749
2400208|acu|RN|-5.58362|-36.914
3100500|acucena|MG|-19.0671|-42.5419
3500105|adamantina|SP|-21.682|-51.0737
5200159|adelandia|GO|-16.4127|-50.1657
3500204|adolfo|SP|-21.2325|-49.6451
4100202|adrianopolis|PR|-24.6606|-48.9922
2900355|adustina|BA|-10.5437|-38.1113
2600104|afogados da ingazeira|PE|-7.74312|-37.631
2400307|afonso bezerra|RN|-5.49229|-36.5075
3200102|afonso claudio|ES|-20.0778|-41.1261
2100105|afonso cunha|MA|-4.13631|-43.3275
2600203|afranio|PE|-8.51136|-41.0095
1500305|afua|PA|-0.154874|-50.3861
2600302|agrestina|PE|-8.45966|-35.9447
2200103|agricolandia|PI|-5.79676|-42.6664
4200200|agrolandia|SC|-27.4087|-49.822
4200309|agronomica|SC|-27.2662|-49.708
1500347|agua azul do norte|PA|-6.79053|-50.4791
3100609|agua boa|MG|-17.9914|-42.3806
5100201|agua boa|MT|-14.051|-52.1601
2200202|agua branca|PI|-5.88856|-42.637
2500106|agua branca|PB|-7.51144|-37.6357
2700102|agua branca|AL|-9.262|-37.938
5000203|agua clara|MS|-20.4452|-52.879
3100708|agua comprida|MG|-20.0576|-48.1069
4200408|agua doce|SC|-26.9985|-51.5528
2100154|agua doce do maranhao|MA|-2.84048|-42.1189
3200169|agua doce do norte|ES|-18.5482|-40.9854
2900405|agua fria|BA|-11.8618|-38.7639
5200175|agua fria de goias|GO|-14.9778|-47.7823
5200209|agua limpa|GO|-18.0771|-48.7603
2400406|agua nova|RN|-6.20351|-38.2941
2600401|agua preta|PE|-8.70609|-35.5263
4300059|agua santa|RS|-28.1672|-52.031
3500303|aguai|SP|-22.0572|-46.9735
3100807|aguanil|MG|-20.9439|-45.3915
2600500|aguas belas|PE|-9.11125|-37.1226
3500402|aguas da prata|SP|-21.9319|-46.7176
4200507|aguas de chapeco|SC|-27.0754|-52.9808
3500501|aguas de lindoia|SP|-22.4733|-46.6314
3500550|aguas de santa barbara|SP|-22.8812|-49.2421
3500600|aguas de sao pedro|SP|-22.5977|-47.8734
3100906|aguas formosas|MG|-17.0802|-40.9384
4200556|aguas frias|SC|-26.8794|-52.8568
5200258|aguas lindas de goias|GO|-15.7617|-48.2816
4200606|aguas mornas|SC|-27.6963|-48.8243
3101003|aguas vermelhas|MG|-15.7431|-41.4571
4300109|agudo|RS|-29.6447|-53.2515
3500709|agudos|SP|-22.4694|-48.9863
4100301|agudos do sul|PR|-25.9899|-49.3343
3200136|aguia branca|ES|-18.9846|-40.7437
2500205|aguiar|PB|-7.0918|-38.1681
1700301|aguiarnopolis|TO|-6.55409|-47.4702
3101102|aimores|MG|-19.5007|-41.0746
2900603|aiquara|BA|-14.1269|-39.8937
2300408|aiuaba|CE|-6.57122|-40.1178
3101201|aiuruoca|MG|-21.9736|-44.6042
4300208|ajuricaba|RS|-28.2342|-53.7757
3101300|alagoa|MG|-22.171|-44.6413
2500304|alagoa grande|PB|-7.03943|-35.6206
2500403|alagoa nova|PB|-7.05377|-35.7591
2500502|alagoinha|PB|-6.94657|-35.5332
2600609|alagoinha|PE|-8.4665|-36.7788
2200251|alagoinha do piaui|PI|-7.00039|-40.9282
2900702|alagoinhas|BA|-12.1335|-38.4208
3500758|alambari|SP|-23.5503|-47.898
3101409|albertina|MG|-22.2018|-46.6139
2100204|alcantara|MA|-2.39574|-44.4062
2300507|alcantaras|CE|-3.58537|-40.5479
2500536|alcantil|PB|-7.73668|-36.0511
5000252|alcinopolis|MS|-18.3255|-53.7042
2900801|alcobaca|BA|-17.5195|-39.2036
2100303|aldeias altas|MA|-4.62621|-43.4689
4300307|alecrim|RS|-27.6579|-54.7649
3200201|alegre|ES|-20.758|-41.5382
4300406|alegrete|RS|-29.7902|-55.7949
2200277|alegrete do piaui|PI|-7.24196|-40.8566
4300455|alegria|RS|-27.8345|-54.0557
3101508|alem paraiba|MG|-21.8797|-42.7176
1500404|alenquer|PA|-1.94623|-54.7384
2400505|alexandria|RN|-6.40533|-38.0142
5200308|alexania|GO|-16.0834|-48.5076
3101607|alfenas|MG|-21.4256|-45.9477
3200300|alfredo chaves|ES|-20.6396|-40.7543
3500808|alfredo marcondes|SP|-21.9527|-51.414
3101631|alfredo vasconcelos|MG|-21.1535|-43.7718
4200705|alfredo wagner|SC|-27.7001|-49.3273
2500577|algodao de jandaira|PB|-6.89292|-36.0129
2500601|alhandra|PB|-7.42977|-34.9057
2600708|alianca|PE|-7.60398|-35.2227
1700350|alianca do tocantins|TO|-11.3056|-48.9361
2900900|almadina|BA|-14.7089|-39.6415
1700400|almas|TO|-11.5706|-47.1792
1500503|almeirim|PA|-1.52904|-52.5788
3101706|almenara|MG|-16.1785|-40.6942
2400604|almino afonso|RN|-6.1475|-37.7636
4100400|almirante tamandare|PR|-25.3188|-49.3037
4300471|almirante tamandare do sul|RS|-28.1149|-52.9142
5200506|aloandia|GO|-17.7292|-49.4769
3101805|alpercata|MG|-18.974|-41.97
4300505|alpestre|RS|-27.2502|-53.0341
3101904|alpinopolis|MG|-20.8631|-46.3878
5100250|alta floresta|MT|-9.86674|-56.0867
1100015|alta floresta d oeste|RO|-11.9283|-61.9953
3500907|altair|SP|-20.5242|-49.0571
1500602|altamira|PA|-3.20407|-52.21
2100402|altamira do maranhao|MA|-4.16598|-45.4706
4100459|altamira do parana|PR|-24.7983|-52.7128
2300606|altaneira|CE|-6.99837|-39.7356
3102001|alterosa|MG|-21.2488|-46.1387
2600807|altinho|PE|-8.48482|-36.0644
3501004|altinopolis|SP|-21.0214|-47.3712
3501103|alto alegre|SP|-21.5811|-50.168
1400050|alto alegre|RR|2.98858|-61.3072
4300554|alto alegre|RS|-28.7769|-52.9893
2100436|alto alegre do maranhao|MA|-4.213|-44.446
2100477|alto alegre do pindare|MA|-3.66689|-45.8421
1100379|alto alegre dos parecis|RO|-12.132|-61.835
5100300|alto araguaia|MT|-17.3153|-53.2181
4200754|alto bela vista|SC|-27.4333|-51.9044
5100359|alto boa vista|MT|-11.6732|-51.3883
3102050|alto caparao|MG|-20.431|-41.8738
2400703|alto do rodrigues|RN|-5.28186|-36.75
4300570|alto feliz|RS|-29.3919|-51.3123
5100409|alto garcas|MT|-16.9462|-53.5272
5200555|alto horizonte|GO|-14.1978|-49.3378
3153509|alto jequitiba|MG|-20.4208|-41.967
2200301|alto longa|PI|-5.25634|-42.2096
5100508|alto paraguai|MT|-14.5137|-56.4776
4128625|alto paraiso|PR|-26.1146|-52.7469
1100403|alto paraiso|RO|-9.71429|-63.3188
5200605|alto paraiso de goias|GO|-14.1305|-47.51
4100608|alto parana|PR|-23.1312|-52.3189
2100501|alto parnaiba|MA|-9.10273|-45.9303
4100707|alto piquiri|PR|-24.0224|-53.44
3102100|alto rio doce|MG|-21.0281|-43.4067
3200359|alto rio novo|ES|-19.0618|-41.0209
2300705|alto santo|CE|-5.50894|-38.2743
5100607|alto taquari|MT|-17.8241|-53.2792
4100509|altonia|PR|-23.8759|-53.8958
2200400|altos|PI|-5.03888|-42.4612
3501152|aluminio|SP|-23.5306|-47.2546
1300029|alvaraes|AM|-3.22727|-64.8007
3102209|alvarenga|MG|-19.4174|-41.7317
3501202|alvares florence|SP|-20.3203|-49.9141
3501301|alvares machado|SP|-22.0764|-51.4722
3501400|alvaro de carvalho|SP|-22.0841|-49.719
3501509|alvinlandia|SP|-22.4435|-49.7623
3102308|alvinopolis|MG|-20.1098|-43.0535
1700707|alvorada|TO|-12.4785|-49.1249
4300604|alvorada|RS|-29.9914|-51.0809
1100346|alvorada d oeste|RO|-11.3463|-62.2847
3102407|alvorada de minas|MG|-18.7334|-43.3638
2200459|alvorada do gurgueia|PI|-8.42418|-43.777
5200803|alvorada do norte|GO|-14.4797|-46.491
4100806|alvorada do sul|PR|-22.7813|-51.2297
1400027|amajari|RR|3.64571|-61.3692
5000609|amambai|MS|-23.1058|-55.2253
1600105|amapa|AP|2.05267|-50.7957
2100550|amapa do maranhao|MA|-1.67524|-46.0024
4100905|amapora|PR|-23.0943|-52.7866
2600906|amaraji|PE|-8.37691|-35.4501
4300638|amaral ferrador|RS|-30.8756|-52.2509
5200829|amaralina|GO|-13.9236|-49.2962
2200509|amarante|PI|-6.24304|-42.8433
2100600|amarante do maranhao|MA|-5.56913|-46.7473
2901007|amargosa|BA|-13.0215|-39.602
1300060|amatura|AM|-3.37455|-68.2005
2901106|amelia rodrigues|BA|-12.3914|-38.7563
2901155|america dourada|BA|-11.4429|-41.439
3501608|americana|SP|-22.7374|-47.3331
5200852|americano do brasil|GO|-16.2514|-49.9831
3501707|americo brasiliense|SP|-21.7288|-48.1147
3501806|americo de campos|SP|-20.2985|-49.7359
4300646|ametista do sul|RS|-27.3607|-53.183
2300754|amontada|CE|-3.36017|-39.8288
5200902|amorinopolis|GO|-16.6151|-51.0919
2500734|amparo|PB|-7.55502|-37.0628
3501905|amparo|SP|-22.7088|-46.772
2800100|amparo de sao francisco|SE|-10.1348|-36.935
3102506|amparo do serra|MG|-20.5051|-42.8009
4101002|ampere|PR|-25.9168|-53.4686
2700201|anadia|AL|-9.68489|-36.3078
2901205|anage|BA|-14.6151|-41.1356
4101051|anahy|PR|-24.6449|-53.1332
1500701|anajas|PA|-0.996811|-49.9354
2100709|anajatuba|MA|-3.26269|-44.6126
3502002|analandia|SP|-22.1289|-47.6619
1300086|anama|AM|-3.56697|-61.3963
1701002|ananas|TO|-6.36437|-48.0735
1500800|ananindeua|PA|-1.36391|-48.3743
5201108|anapolis|GO|-16.3281|-48.953
1500859|anapu|PA|-3.46985|-51.2003
2100808|anapurus|MA|-3.67577|-43.1014
5000708|anastacio|MS|-20.4823|-55.8104
5000807|anaurilandia|MS|-22.1852|-52.7191
4200804|anchieta|SC|-26.5382|-53.3319
3200409|anchieta|ES|-20.7955|-40.6425
2901304|andarai|BA|-12.8049|-41.3297
4101101|andira|PR|-23.0533|-50.2304
2901353|andorinha|BA|-10.3482|-39.8391
3102605|andradas|MG|-22.0695|-46.5724
3502101|andradina|SP|-20.8948|-51.3786
4300661|andre da rocha|RS|-28.6283|-51.5797
3102803|andrelandia|MG|-21.7411|-44.3117
3502200|angatuba|SP|-23.4917|-48.4139
3102852|angelandia|MG|-17.7279|-42.2641
5000856|angelica|MS|-22.1527|-53.7708
2601003|angelim|PE|-8.88429|-36.2902
4200903|angelina|SC|-27.5704|-48.9879
2901403|angical|BA|-12.0063|-44.7003
2200608|angical do piaui|PI|-6.08786|-42.74
1701051|angico|TO|-6.39179|-47.8611
2400802|angicos|RN|-5.65792|-36.6094
3300100|angra dos reis|RJ|-23.0011|-44.3196
2901502|anguera|BA|-12.1462|-39.2462
4101150|angulo|PR|-23.1946|-51.9154
5201207|anhanguera|GO|-18.3339|-48.2204
3502309|anhembi|SP|-22.793|-48.1336
3502408|anhumas|SP|-22.2934|-51.3895
5201306|anicuns|GO|-16.4642|-49.9617
2200707|anisio de abreu|PI|-9.18564|-43.0494
4201000|anita garibaldi|SC|-27.6897|-51.1271
4201109|anitapolis|SC|-27.9012|-49.1316
1300102|anori|AM|-3.74603|-61.6575
4300703|anta gorda|RS|-28.9698|-52.0102
2901601|antas|BA|-10.3856|-38.3401
4101200|antonina|PR|-25.4386|-48.7191
2300804|antonina do norte|CE|-6.76919|-39.987
2200806|antonio almeida|PI|-7.21276|-44.1889
2901700|antonio cardoso|BA|-12.4335|-39.1176
4201208|antonio carlos|SC|-27.5191|-48.766
3102902|antonio carlos|MG|-21.321|-43.7451
3103009|antonio dias|MG|-19.6491|-42.8732
2901809|antonio goncalves|BA|-10.5767|-40.2785
5000906|antonio joao|MS|-22.1927|-55.9517
2400901|antonio martins|RN|-6.21367|-37.8834
4101309|antonio olinto|PR|-25.9804|-50.1972
4300802|antonio prado|RS|-28.8565|-51.2883
3103108|antonio prado de minas|MG|-21.0192|-42.1109
2500775|aparecida|PB|-6.78466|-38.0803
3502507|aparecida|SP|-22.8495|-45.2325
3502606|aparecida d oeste|SP|-20.4487|-50.8835
5201405|aparecida de goiania|GO|-16.8198|-49.2469
5201454|aparecida do rio doce|GO|-18.2941|-51.1516
1701101|aparecida do rio negro|TO|-9.94139|-47.9638
5001003|aparecida do taboado|MS|-20.0873|-51.0961
3300159|aperibe|RJ|-21.6252|-42.1017
3200508|apiaca|ES|-21.1523|-41.5693
5100805|apiacas|MT|-9.53981|-57.4587
3502705|apiai|SP|-24.5108|-48.8443
2100832|apicum acu|MA|-1.45862|-45.0864
4201257|apiuna|SC|-27.0375|-49.3885
2401008|apodi|RN|-5.65349|-37.7946
2901908|apora|BA|-11.6577|-38.0814
5201504|apore|GO|-18.9607|-51.9232
2901957|apuarema|BA|-13.8542|-39.7501
4101408|apucarana|PR|-23.55|-51.4635
1300144|apui|AM|-7.19409|-59.896
2300903|apuiares|CE|-3.94506|-39.4359
2800209|aquidaba|SE|-10.278|-37.0148
5001102|aquidauana|MS|-20.4666|-55.7868
2301000|aquiraz|CE|-3.89929|-38.3896
4201273|arabuta|SC|-27.1587|-52.1423
2500809|aracagi|PB|-6.84374|-35.3737
3103207|aracai|MG|-19.1955|-44.2493
2800308|aracaju|SE|-10.9091|-37.0677
3502754|aracariguama|SP|-23.4366|-47.0608
2902054|aracas|BA|-12.22|-38.2027
2301109|aracati|CE|-4.55826|-37.7679
2902005|aracatu|BA|-14.428|-41.4648
3502804|aracatuba|SP|-21.2076|-50.4401
2902104|araci|BA|-11.3253|-38.9584
3103306|aracitaba|MG|-21.3446|-43.3736
2601052|aracoiaba|PE|-7.78391|-35.0809
2301208|aracoiaba|CE|-4.36872|-38.8125
3502903|aracoiaba da serra|SP|-23.5029|-47.6166
3200607|aracruz|ES|-19.82|-40.2764
5201603|aracu|GO|-16.3563|-49.6804
3103405|aracuai|MG|-16.8523|-42.0637
5201702|aragarcas|GO|-15.8955|-52.2372
5201801|aragoiania|GO|-16.9087|-49.4476
1701309|aragominas|TO|-7.16005|-48.5291
1701903|araguacema|TO|-8.80755|-49.5569
1702000|araguacu|TO|-12.9289|-49.8231
5101001|araguaiana|MT|-15.7291|-51.8341
1702109|araguaina|TO|-7.19238|-48.2044
5101209|araguainha|MT|-16.857|-53.0318
1702158|araguana|TO|-6.58225|-48.6395
2100873|araguana|MA|-2.94644|-45.6589
5202155|araguapaz|GO|-15.0909|-50.6315
3103504|araguari|MG|-18.6456|-48.1934
1702208|araguatins|TO|-5.64659|-48.1232
2100907|araioses|MA|-2.89091|-41.905
5001243|aral moreira|MS|-22.9385|-55.6334
2902203|aramari|BA|-12.0884|-38.4969
4300851|arambare|RS|-30.9092|-51.5046
2100956|arame|MA|-4.88347|-46.0032
3503000|aramina|SP|-20.0882|-47.7873
3503109|arandu|SP|-23.1386|-49.0487
3103603|arantina|MG|-21.9102|-44.2555
3503158|arapei|SP|-22.6717|-44.4441
2700300|arapiraca|AL|-9.75487|-36.6615
1702307|arapoema|TO|-7.65463|-49.0637
3103702|araponga|MG|-20.6686|-42.5178
4101507|arapongas|PR|-23.4153|-51.4259
3103751|arapora|MG|-18.4357|-49.1847
4101606|arapoti|PR|-24.1548|-49.8285
4101655|arapua|PR|-24.3132|-51.7856
3103801|arapua|MG|-19.0268|-46.1484
5101258|araputanga|MT|-15.4641|-58.3425
4201307|araquari|SC|-26.3754|-48.7188
2500908|arara|PB|-6.82813|-35.7552
4201406|ararangua|SC|-28.9356|-49.4918
3503208|araraquara|SP|-21.7845|-48.178
3503307|araras|SP|-22.3572|-47.3842
2301257|ararenda|CE|-4.74567|-40.831
2101004|arari|MA|-3.45214|-44.7665
4300877|ararica|RS|-29.6168|-50.9291
2301307|araripe|CE|-7.21319|-40.1359
2601102|araripina|PE|-7.57073|-40.494
3300209|araruama|RJ|-22.8697|-42.3326
4101705|araruna|PR|-23.9315|-52.5021
2501005|araruna|PB|-6.54848|-35.7498
2902252|arataca|BA|-15.2651|-39.419
4300901|aratiba|RS|-27.3978|-52.2975
2301406|aratuba|CE|-4.41229|-39.0471
2902302|aratuipe|BA|-13.0716|-39.0038
2800407|araua|SE|-11.2614|-37.6201
4101804|araucaria|PR|-25.5859|-49.4047
3103900|araujos|MG|-19.9405|-45.1671
3104007|araxa|MG|-19.5902|-46.9438
3104106|arceburgo|MG|-21.359|-46.9401
3503356|arco iris|SP|-21.7728|-50.466
3104205|arcos|MG|-20.2863|-45.5373
2601201|arcoverde|PE|-8.41519|-37.0577
3104304|areado|MG|-21.3572|-46.1421
3300225|areal|RJ|-22.2283|-43.1118
3503406|arealva|SP|-22.031|-48.9135
2501104|areia|PB|-6.96396|-35.6977
2401107|areia branca|RN|-4.95254|-37.1252
2800506|areia branca|SE|-10.758|-37.3251
2501153|areia de baraunas|PB|-7.11702|-36.9404
2501203|areial|PB|-7.04789|-35.9313
3503505|areias|SP|-22.5786|-44.6992
3503604|areiopolis|SP|-22.6672|-48.6681
5101308|arenapolis|MT|-14.4472|-56.8437
5202353|arenopolis|GO|-16.3837|-51.5563
2401206|ares|RN|-6.18831|-35.1608
3104403|argirita|MG|-21.6083|-42.8292
3104452|aricanduva|MG|-17.8666|-42.5533
3104502|arinos|MG|-15.9187|-46.1043
5101407|aripuana|MT|-10.1723|-59.4568
1100023|ariquemes|RO|-9.90571|-63.0325
3503703|ariranha|SP|-21.1872|-48.7904
4101853|ariranha do ivai|PR|-24.3857|-51.5839
3300233|armacao dos buzios|RJ|-22.7528|-41.8846
4201505|armazem|SC|-28.2448|-49.0215
2301505|arneiroz|CE|-6.3165|-40.1653
2200905|aroazes|PI|-6.11022|-41.7822
2501302|aroeiras|PB|-7.54473|-35.7066
2200954|aroeiras do itaim|PI|-7.24502|-41.5325
2201002|arraial|PI|-6.65075|-42.5418
3300258|arraial do cabo|RJ|-22.9774|-42.0267
1702406|arraias|TO|-12.9287|-46.9359
4301008|arroio do meio|RS|-29.4014|-51.9557
4301073|arroio do padre|RS|-31.4389|-52.4246
4301057|arroio do sal|RS|-29.5439|-49.8895
4301206|arroio do tigre|RS|-29.3348|-53.0966
4301107|arroio dos ratos|RS|-30.0875|-51.7275
4301305|arroio grande|RS|-32.2327|-53.0862
4201604|arroio trinta|SC|-26.9257|-51.3407
3503802|artur nogueira|SP|-22.5727|-47.1727
5202502|aruana|GO|-14.9166|-51.075
3503901|aruja|SP|-23.3965|-46.32
4201653|arvoredo|SC|-27.0748|-52.4543
4301404|arvorezinha|RS|-28.8737|-52.1781
4201703|ascurra|SC|-26.9548|-49.3783
3503950|aspasia|SP|-20.16|-50.728
4101903|assai|PR|-23.3697|-50.8459
2301604|assare|CE|-6.8669|-39.8689
3504008|assis|SP|-22.66|-50.4183
1200054|assis brasil|AC|-10.9298|-69.5738
4102000|assis chateaubriand|PR|-24.4168|-53.5213
2501351|assuncao|PB|-7.07231|-36.725
2201051|assuncao do piaui|PI|-5.865|-41.0389
3104601|astolfo dutra|MG|-21.3184|-42.8572
4102109|astorga|PR|-23.2318|-51.6668
4102208|atalaia|PR|-23.1517|-52.0551
2700409|atalaia|AL|-9.5119|-36.0086
1300201|atalaia do norte|AM|-4.37055|-70.1967
4201802|atalanta|SC|-27.4219|-49.7789
3104700|ataleia|MG|-18.0438|-41.1149
3504107|atibaia|SP|-23.1171|-46.5563
3200706|atilio vivacqua|ES|-20.913|-41.1986
1702554|augustinopolis|TO|-5.46863|-47.8863
1500909|augusto correa|PA|-1.05109|-46.6147
3104809|augusto de lima|MG|-18.0997|-44.2655
4301503|augusto pestana|RS|-28.5172|-53.9883
2401305|augusto severo campo grande|RN|-5.86206|-37.3135
4301552|aurea|RS|-27.6936|-52.0505
2902401|aurelino leal|BA|-14.321|-39.329
3504206|auriflama|SP|-20.6836|-50.5572
5202601|aurilandia|GO|-16.6773|-50.4641
2301703|aurora|CE|-6.93349|-38.9742
4201901|aurora|SC|-27.3098|-49.6295
1500958|aurora do para|PA|-2.14898|-47.5677
1702703|aurora do tocantins|TO|-12.7105|-46.4076
1300300|autazes|AM|-3.58574|-59.1256
3504305|avai|SP|-22.1514|-49.3356
3504404|avanhandava|SP|-21.4584|-49.9509
3504503|avare|SP|-23.1067|-48.9251
1501006|aveiro|PA|-3.60841|-55.3199
2201101|avelino lopes|PI|-10.1345|-43.9563
5202809|avelinopolis|GO|-16.4672|-49.7579
2101103|axixa|MA|-2.83939|-44.062
1702901|axixa do tocantins|TO|-5.61275|-47.7701
1703008|babaculandia|TO|-7.20923|-47.7613
2101202|bacabal|MA|-4.22447|-44.7832
2101251|bacabeira|MA|-2.96452|-44.3164
2101301|bacuri|MA|-1.6965|-45.1328
2101350|bacurituba|MA|-2.71|-44.7329
3504602|bady bassitt|SP|-20.9197|-49.4385
3104908|baependi|MG|-21.957|-44.8874
4301602|bage|RS|-31.3297|-54.0999
1501105|bagre|PA|-1.90057|-50.1987
2501401|baia da traicao|PB|-6.69209|-34.9381
2401404|baia formosa|RN|-6.37161|-35.0033
2902500|baianopolis|BA|-12.3016|-44.5388
1501204|baiao|PA|-2.79021|-49.6694
2902609|baixa grande|BA|-11.9519|-40.169
2201150|baixa grande do ribeiro|PI|-7.84903|-45.219
2301802|baixio|CE|-6.71945|-38.7134
3200805|baixo guandu|ES|-19.5213|-41.0109
3504701|balbinos|SP|-21.8963|-49.3619
3105004|baldim|MG|-19.2832|-43.9613
5203104|baliza|GO|-16.1966|-52.5393
4201950|balneario arroio do silva|SC|-28.9806|-49.4237
4202057|balneario barra do sul|SC|-26.4597|-48.6123
4202008|balneario camboriu|SC|-26.9926|-48.6352
4202073|balneario gaivota|SC|-29.1527|-49.5841
4212809|balneario picarras|SC|-26.7639|-48.6717
4301636|balneario pinhal|RS|-30.2419|-50.2337
4220000|balneario rincao|SC|-28.8314|-49.2352
4102307|balsa nova|PR|-25.5804|-49.6291
3504800|balsamo|SP|-20.7348|-49.5865
2101400|balsas|MA|-7.53214|-46.0372
3105103|bambui|MG|-20.0166|-45.9754
2301851|banabuiu|CE|-5.30454|-38.9132
3504909|bananal|SP|-22.6819|-44.3281
2501500|bananeiras|PB|-6.74775|-35.6246
3105202|bandeira|MG|-15.8783|-40.5622
3105301|bandeira do sul|MG|-21.7308|-46.3833
4202081|bandeirante|SC|-26.7705|-53.6413
5001508|bandeirantes|MS|-19.9275|-54.3585
4102406|bandeirantes|PR|-23.1078|-50.3704
1703057|bandeirantes do tocantins|TO|-7.75612|-48.5836
1501253|bannach|PA|-7.34779|-50.3959
2902658|banzae|BA|-10.5788|-38.6212
4301651|barao|RS|-29.3725|-51.4949
3505005|barao de antonina|SP|-23.6284|-49.5634
3105400|barao de cocais|MG|-19.9389|-43.4755
4301701|barao de cotegipe|RS|-27.6208|-52.3798
2101509|barao de grajau|MA|-6.74463|-43.0261
5101605|barao de melgaco|MT|-16.2067|-55.9623
3105509|barao de monte alto|MG|-21.2444|-42.2372
4301750|barao do triunfo|RS|-30.3891|-51.7384
2401453|barauna|RN|-5.06977|-37.6129
2501534|barauna|PB|-6.63484|-36.2601
3105608|barbacena|MG|-21.2214|-43.7703
2301901|barbalha|CE|-7.2982|-39.3021
3505104|barbosa|SP|-21.2657|-49.9518
4102505|barbosa ferraz|PR|-24.0334|-52.004
1501303|barcarena|PA|-1.51187|-48.6195
2401503|barcelona|RN|-5.94284|-35.9247
1300409|barcelos|AM|-0.983373|-62.9311
3505203|bariri|SP|-22.073|-48.7438
2902708|barra|BA|-11.0859|-43.1459
4202099|barra bonita|SC|-26.654|-53.44
3505302|barra bonita|SP|-22.4909|-48.5583
2201176|barra d alcantara|PI|-6.51645|-42.1146
2902807|barra da estiva|BA|-13.6237|-41.3347
2601300|barra de guabiraba|PE|-8.42075|-35.6585
2501609|barra de santa rosa|PB|-6.71816|-36.0671
2501575|barra de santana|PB|-7.51809|-35.9913
2700508|barra de santo antonio|AL|-9.4023|-35.5101
3200904|barra de sao francisco|ES|-18.7548|-40.8965
2501708|barra de sao miguel|PB|-7.74603|-36.3209
2700607|barra de sao miguel|AL|-9.83842|-35.9057
5101704|barra do bugres|MT|-15.0702|-57.1878
3505351|barra do chapeu|SP|-24.4722|-49.0238
2902906|barra do choca|BA|-14.8654|-40.5791
2101608|barra do corda|MA|-5.49682|-45.2485
5101803|barra do garcas|MT|-15.8804|-52.264
4301859|barra do guarita|RS|-27.1927|-53.7109
4102703|barra do jacare|PR|-23.116|-50.1842
2903003|barra do mendes|BA|-11.81|-42.059
1703073|barra do ouro|TO|-7.69593|-47.6776
3300308|barra do pirai|RJ|-22.4715|-43.8269
4301875|barra do quarai|RS|-30.2029|-57.5497
4301909|barra do ribeiro|RS|-30.2939|-51.3014
4301925|barra do rio azul|RS|-27.4069|-52.4084
2903102|barra do rocha|BA|-14.2|-39.5991
3505401|barra do turvo|SP|-24.759|-48.5013
2800605|barra dos coqueiros|SE|-10.8996|-37.0323
4301958|barra funda|RS|-27.9205|-53.0391
3105707|barra longa|MG|-20.2869|-43.0402
3300407|barra mansa|RJ|-22.5481|-44.1752
4202107|barra velha|SC|-26.637|-48.6933
4301800|barracao|RS|-27.6739|-51.4585
4102604|barracao|PR|-26.2502|-53.6324
2201200|barras|PI|-4.24468|-42.2922
2301950|barreira|CE|-4.28921|-38.6429
2903201|barreiras|BA|-12.1439|-44.9968
2201309|barreiras do piaui|PI|-9.9296|-45.4702
1300508|barreirinha|AM|-2.79886|-57.0679
2101707|barreirinhas|MA|-2.75863|-42.8232
2601409|barreiros|PE|-8.81605|-35.1832
3505500|barretos|SP|-20.5531|-48.5698
3505609|barrinha|SP|-21.1864|-48.1636
2302008|barro|CE|-7.17188|-38.7741
2903235|barro alto|BA|-11.7605|-41.9054
5203203|barro alto|GO|-14.9658|-48.9086
2201408|barro duro|PI|-5.81673|-42.5147
2903300|barro preto|BA|-14.7948|-39.476
2903276|barrocas|BA|-11.5272|-39.0776
1703107|barrolandia|TO|-9.83404|-48.7252
2302057|barroquinha|CE|-3.02051|-41.1358
4302006|barros cassal|RS|-29.0947|-52.5836
3105905|barroso|MG|-21.1907|-43.972
3505708|barueri|SP|-23.5057|-46.879
3505807|bastos|SP|-21.921|-50.7357
5001904|bataguassu|MS|-21.7159|-52.4221
2201507|batalha|PI|-4.0223|-42.0787
2700706|batalha|AL|-9.6742|-37.133
3505906|batatais|SP|-20.8929|-47.5921
5002001|bataypora|MS|-22.2944|-53.2705
2302107|baturite|CE|-4.32598|-38.8812
3506003|bauru|SP|-22.3246|-49.0871
2501807|bayeux|PB|-7.1238|-34.9293
3506102|bebedouro|SP|-20.9491|-48.4791
2302206|beberibe|CE|-4.17741|-38.1271
2302305|bela cruz|CE|-3.04996|-40.1671
5002100|bela vista|MS|-22.1073|-56.5263
4102752|bela vista da caroba|PR|-25.8842|-53.6725
5203302|bela vista de goias|GO|-16.9693|-48.9513
3106002|bela vista de minas|MG|-19.8302|-43.0922
2101772|bela vista do maranhao|MA|-3.72618|-45.3075
4102802|bela vista do paraiso|PR|-22.9937|-51.1927
2201556|bela vista do piaui|PI|-7.98809|-41.8675
4202131|bela vista do toldo|SC|-26.2746|-50.4664
2101731|belagua|MA|-3.15485|-43.5122
1501402|belem|PA|-1.4554|-48.4898
2501906|belem|PB|-6.74261|-35.5166
2700805|belem|AL|-9.57047|-36.4904
2601508|belem de maria|PE|-8.62504|-35.8335
2502003|belem do brejo do cruz|PB|-6.18515|-37.5348
2201572|belem do piaui|PI|-7.36652|-40.9688
2601607|belem do sao francisco|PE|-8.75046|-38.9623
3300456|belford roxo|RJ|-22.764|-43.3992
3106101|belmiro braga|MG|-21.944|-43.4084
4202156|belmonte|SC|-26.843|-53.5758
2903409|belmonte|BA|-15.8608|-38.8758
2903508|belo campo|BA|-15.0334|-41.2652
3106200|belo horizonte|MG|-19.9102|-43.9266
2601706|belo jardim|PE|-8.3313|-36.4258
2700904|belo monte|AL|-9.82272|-37.277
3106309|belo oriente|MG|-19.2199|-42.4828
3106408|belo vale|MG|-20.4077|-44.0275
1501451|belterra|PA|-2.63609|-54.9374
2201606|beneditinos|PI|-5.45676|-42.3638
2101806|benedito leite|MA|-7.21037|-44.5577
4202206|benedito novo|SC|-26.781|-49.3593
1501501|benevides|PA|-1.36183|-48.2434
1300607|benjamin constant|AM|-4.37768|-70.0342
4302055|benjamin constant do sul|RS|-27.5086|-52.5995
3506201|bento de abreu|SP|-21.2686|-50.814
2401602|bento fernandes|RN|-5.69906|-35.813
4302105|bento goncalves|RS|-29.1662|-51.5165
2101905|bequimao|MA|-2.44162|-44.7842
3106507|berilo|MG|-16.9567|-42.4606
3106655|berizal|MG|-15.61|-41.7432
2502052|bernardino batista|PB|-6.44572|-38.5521
3506300|bernardino de campos|SP|-23.0164|-49.4679
2101939|bernardo do mearim|MA|-4.62666|-44.7608
1703206|bernardo sayao|TO|-7.87481|-48.8893
3506359|bertioga|SP|-23.8486|-46.1396
2201705|bertolinia|PI|-7.63338|-43.9498
3106606|bertopolis|MG|-17.059|-40.58
1300631|beruri|AM|-3.89874|-61.3616
2601805|betania|PE|-8.26787|-38.0345
2201739|betania do piaui|PI|-8.14376|-40.7989
3106705|betim|MG|-19.9668|-44.2008
2601904|bezerros|PE|-8.2328|-35.796
3106804|bias fortes|MG|-21.602|-43.7574
3106903|bicas|MG|-21.7232|-43.056
4202305|biguacu|SC|-27.496|-48.6598
3506409|bilac|SP|-21.404|-50.4746
3107000|biquinhas|MG|-18.7754|-45.4974
3506508|birigui|SP|-21.291|-50.3432
3506607|biritiba mirim|SP|-23.5698|-46.0407
2903607|biritinga|BA|-11.6072|-38.8051
4102901|bituruna|PR|-26.1607|-51.5518
4202404|blumenau|SC|-26.9155|-49.0709
4103008|boa esperanca|PR|-24.2467|-52.7876
3107109|boa esperanca|MG|-21.0927|-45.5612
3201001|boa esperanca|ES|-18.5395|-40.3025
4103024|boa esperanca do iguacu|PR|-25.6324|-53.2108
3506706|boa esperanca do sul|SP|-21.9918|-48.3906
2201770|boa hora|PI|-4.41404|-42.1357
2903706|boa nova|BA|-14.3598|-40.2064
2502102|boa ventura|PB|-7.40982|-38.2113
4103040|boa ventura de sao roque|PR|-24.8688|-51.6276
2302404|boa viagem|CE|-5.11258|-39.7337
1400100|boa vista|RR|2.82384|-60.6753
2502151|boa vista|PB|-7.26365|-36.2357
4103057|boa vista da aparecida|PR|-25.4308|-53.4117
4302154|boa vista das missoes|RS|-27.6671|-53.3102
4302204|boa vista do burica|RS|-27.6693|-54.1082
4302220|boa vista do cadeado|RS|-28.5791|-53.8108
2101970|boa vista do gurupi|MA|-1.77614|-46.3002
4302238|boa vista do incra|RS|-28.8185|-53.391
1300680|boa vista do ramos|AM|-2.97409|-57.5873
4302253|boa vista do sul|RS|-29.3544|-51.6687
2903805|boa vista do tupim|BA|-12.6498|-40.6064
2701001|boca da mata|AL|-9.64308|-36.2125
1300706|boca do acre|AM|-8.74232|-67.3919
2201804|bocaina|PI|-6.94124|-41.3168
3506805|bocaina|SP|-22.1365|-48.523
3107208|bocaina de minas|MG|-22.1697|-44.3972
4202438|bocaina do sul|SC|-27.7455|-49.9423
3107307|bocaiuva|MG|-17.1135|-43.8104
4103107|bocaiuva do sul|PR|-25.2066|-49.1141
2401651|bodo|RN|-5.98027|-36.4167
2602001|bodoco|PE|-7.77759|-39.9338
5002159|bodoquena|MS|-20.537|-56.7127
3506904|bofete|SP|-23.1055|-48.2582
3507001|boituva|SP|-23.2855|-47.6786
2602100|bom conselho|PE|-9.16919|-36.6857
3107406|bom despacho|MG|-19.7386|-45.2622
3300506|bom jardim|RJ|-22.1545|-42.4251
2602209|bom jardim|PE|-7.79695|-35.5784
2102002|bom jardim|MA|-3.54129|-45.606
4202503|bom jardim da serra|SC|-28.3377|-49.6373
5203401|bom jardim de goias|GO|-16.2063|-52.1728
3107505|bom jardim de minas|MG|-21.9479|-44.1885
4202537|bom jesus|SC|-26.7326|-52.3919
4302303|bom jesus|RS|-28.6697|-50.4295
2201903|bom jesus|PI|-9.07124|-44.359
2401701|bom jesus|RN|-5.98648|-35.5792
2502201|bom jesus|PB|-6.81601|-38.6453
2903904|bom jesus da lapa|BA|-13.2506|-43.4108
3107604|bom jesus da penha|MG|-21.0148|-46.5174
2903953|bom jesus da serra|BA|-14.3663|-40.5126
2102036|bom jesus das selvas|MA|-4.47638|-46.8641
5203500|bom jesus de goias|GO|-18.2173|-49.74
3107703|bom jesus do amparo|MG|-19.7054|-43.4782
5101852|bom jesus do araguaia|MT|-12.1706|-51.5032
3107802|bom jesus do galho|MG|-19.836|-42.3165
3300605|bom jesus do itabapoana|RJ|-21.1449|-41.6822
3201100|bom jesus do norte|ES|-21.1173|-41.6731
4202578|bom jesus do oeste|SC|-26.6927|-53.0967
4103156|bom jesus do sul|PR|-26.1958|-53.5955
1501576|bom jesus do tocantins|PA|-5.0424|-48.6047
1703305|bom jesus do tocantins|TO|-8.96306|-48.165
3507100|bom jesus dos perdoes|SP|-23.1356|-46.4675
2102077|bom lugar|MA|-4.37311|-45.0326
4302352|bom principio|RS|-29.4856|-51.3548
2201919|bom principio do piaui|PI|-3.19631|-41.6403
4302378|bom progresso|RS|-27.5399|-53.8716
3107901|bom repouso|MG|-22.4675|-46.144
4202602|bom retiro|SC|-27.799|-49.487
4302402|bom retiro do sul|RS|-29.6071|-51.9456
3108008|bom sucesso|MG|-21.0329|-44.7537
4103206|bom sucesso|PR|-23.7063|-51.7671
2502300|bom sucesso|PB|-6.44176|-37.9234
3507159|bom sucesso de itarare|SP|-24.3155|-49.1451
4103222|bom sucesso do sul|PR|-26.0731|-52.8353
4202453|bombinhas|SC|-27.1382|-48.5146
1400159|bonfim|RR|3.36161|-59.8333
3108107|bonfim|MG|-20.3302|-44.2366
2201929|bonfim do piaui|PI|-9.1605|-42.8865
5203559|bonfinopolis|GO|-16.6173|-48.9616
3108206|bonfinopolis de minas|MG|-16.568|-45.9839
2904001|boninal|BA|-12.7069|-41.8286
2602308|bonito|PE|-8.47163|-35.7292
2904050|bonito|BA|-11.9668|-41.2647
1501600|bonito|PA|-1.36745|-47.3066
5002209|bonito|MS|-21.1261|-56.4836
3108255|bonito de minas|MG|-15.3231|-44.7543
2502409|bonito de santa fe|PB|-7.31341|-38.5133
5203575|bonopolis|GO|-13.6329|-49.8106
2502508|boqueirao|PB|-7.487|-36.1309
4302451|boqueirao do leao|RS|-29.3046|-52.4284
2201945|boqueirao do piaui|PI|-4.48181|-42.1212
2800670|boquim|SE|-11.1397|-37.6195
2904100|boquira|BA|-12.8205|-42.7324
3507209|bora|SP|-22.2696|-50.5409
3507308|boraceia|SP|-22.1926|-48.7808
1300805|borba|AM|-4.39154|-59.5874
2502706|borborema|PB|-6.80199|-35.6187
3507407|borborema|SP|-21.6214|-49.0741
3108305|borda da mata|MG|-22.2707|-46.1653
3507456|borebi|SP|-22.5728|-48.9707
4103305|borrazopolis|PR|-23.9366|-51.5875
4302501|bossoroca|RS|-28.7291|-54.9035
3108404|botelhos|MG|-21.6412|-46.391
3507506|botucatu|SP|-22.8837|-48.4437
3108503|botumirim|MG|-16.8657|-43.0086
2904209|botupora|BA|-13.3772|-42.5163
4202701|botuvera|SC|-27.2007|-49.0689
4302584|bozano|RS|-28.3659|-53.772
4202800|braco do norte|SC|-28.2681|-49.1701
4202859|braco do trombudo|SC|-27.3586|-49.8821
4302600|braga|RS|-27.6173|-53.7405
1501709|braganca|PA|-1.06126|-46.7826
3507605|braganca paulista|SP|-22.9527|-46.5419
4103354|braganey|PR|-24.8173|-53.1218
2701100|branquinha|AL|-9.23342|-36.0162
3108701|bras pires|MG|-20.8419|-43.2406
1501725|brasil novo|PA|-3.29792|-52.534
5002308|brasilandia|MS|-21.2544|-52.0365
3108552|brasilandia de minas|MG|-16.9999|-46.0081
4103370|brasilandia do sul|PR|-24.1978|-53.5275
1703602|brasilandia do tocantins|TO|-8.38918|-48.4822
1200104|brasileia|AC|-10.995|-68.7497
2201960|brasileira|PI|-4.1337|-41.7859
5300108|brasilia|DF|-15.7795|-47.9297
3108602|brasilia de minas|MG|-16.2104|-44.4299
5101902|brasnorte|MT|-12.1474|-57.9833
3507704|brauna|SP|-21.499|-50.3175
3108800|braunas|MG|-19.0562|-42.7099
5203609|brazabrantes|GO|-16.4281|-49.3863
3108909|brazopolis|MG|-22.4743|-45.6166
2602407|brejao|PE|-9.02915|-36.566
3201159|brejetuba|ES|-20.1395|-41.2954
2401800|brejinho|RN|-6.18566|-35.3591
2602506|brejinho|PE|-7.34694|-37.2865
1703701|brejinho de nazare|TO|-11.0058|-48.5683
2102101|brejo|MA|-3.67796|-42.7527
3507753|brejo alegre|SP|-21.1651|-50.1861
2602605|brejo da madre de deus|PE|-8.14933|-36.3741
2102150|brejo de areia|MA|-4.334|-45.581
2502805|brejo do cruz|PB|-6.34185|-37.4943
2201988|brejo do piaui|PI|-8.20314|-42.8229
2502904|brejo dos santos|PB|-6.37065|-37.8253
2800704|brejo grande|SE|-10.4297|-36.4611
1501758|brejo grande do araguaia|PA|-5.69822|-48.4103
2302503|brejo santo|CE|-7.48469|-38.9799
2904308|brejoes|BA|-13.1039|-39.7988
2904407|brejolandia|BA|-12.4815|-43.9679
1501782|breu branco|PA|-3.77191|-49.5735
1501808|breves|PA|-1.68036|-50.4791
5203807|britania|GO|-15.2428|-51.1602
4302659|brochier|RS|-29.5501|-51.5945
3507803|brodowski|SP|-20.9845|-47.6572
3507902|brotas|SP|-22.2795|-48.1251
2904506|brotas de macaubas|BA|-11.9915|-42.6326
3109006|brumadinho|MG|-20.151|-44.2007
2904605|brumado|BA|-14.2021|-41.6696
4202875|brunopolis|SC|-27.3058|-50.8684
4202909|brusque|SC|-27.0977|-48.9107
3109105|bueno brandao|MG|-22.4383|-46.3491
3109204|buenopolis|MG|-17.8744|-44.1775
2602704|buenos aires|PE|-7.72449|-35.3182
2904704|buerarema|BA|-14.9595|-39.3028
3109253|bugre|MG|-19.4231|-42.2552
2602803|buique|PE|-8.61954|-37.1606
1200138|bujari|AC|-9.81528|-67.955
1501907|bujaru|PA|-1.51762|-48.0381
3508009|buri|SP|-23.7977|-48.5958
3508108|buritama|SP|-21.0661|-50.1475
2102200|buriti|MA|-3.94169|-42.9179
5203906|buriti alegre|GO|-18.1378|-49.0404
2102309|buriti bravo|MA|-5.83239|-43.8353
5203939|buriti de goias|GO|-16.1792|-50.4302
1703800|buriti do tocantins|TO|-5.31448|-48.2271
2202000|buriti dos lopes|PI|-3.18259|-41.8695
2202026|buriti dos montes|PI|-5.30584|-41.0933
2102325|buriticupu|MA|-4.32375|-46.4409
5203962|buritinopolis|GO|-14.4772|-46.4076
2904753|buritirama|BA|-10.7171|-43.6302
2102358|buritirana|MA|-5.59823|-47.0131
1100452|buritis|RO|-10.1943|-63.8324
3109303|buritis|MG|-15.6218|-46.4221
3508207|buritizal|SP|-20.1911|-47.7096
3109402|buritizeiro|MG|-17.3656|-44.9606
4302709|butia|RS|-30.1179|-51.9601
1300839|caapiranga|AM|-3.31537|-61.2206
2503001|caapora|PB|-7.51351|-34.9055
5002407|caarapo|MS|-22.6368|-54.8209
2904803|caatiba|BA|-14.9699|-40.4092
2503100|cabaceiras|PB|-7.48899|-36.287
2904852|cabaceiras do paraguacu|BA|-12.5317|-39.1902
3109451|cabeceira grande|MG|-16.0335|-47.0862
5204003|cabeceiras|GO|-15.7995|-46.9265
2202059|cabeceiras do piaui|PI|-4.4773|-42.3069
2503209|cabedelo|PB|-6.98731|-34.8284
1100031|cabixi|RO|-13.4945|-60.552
2602902|cabo de santo agostinho|PE|-8.28218|-35.0253
3300704|cabo frio|RJ|-22.8894|-42.0286
3109501|cabo verde|MG|-21.4699|-46.3919
3508306|cabralia paulista|SP|-22.4576|-49.3393
3508405|cabreuva|SP|-23.3053|-47.1362
2603009|cabrobo|PE|-8.50548|-39.3094
4203006|cacador|SC|-26.7757|-51.012
3508504|cacapava|SP|-23.0992|-45.7076
4302808|cacapava do sul|RS|-30.5144|-53.4827
1100601|cacaulandia|RO|-10.349|-62.9043
4302907|cacequi|RS|-29.8883|-54.822
5102504|caceres|MT|-16.0764|-57.6818
2904902|cachoeira|BA|-12.5994|-38.9587
5204102|cachoeira alta|GO|-18.7618|-50.9432
3109600|cachoeira da prata|MG|-19.521|-44.4544
5204201|cachoeira de goias|GO|-16.6635|-50.646
3109709|cachoeira de minas|MG|-22.3511|-45.7809
3102704|cachoeira de pajeu|MG|-15.9688|-41.4948
1502004|cachoeira do arari|PA|-1.01226|-48.9503
1501956|cachoeira do piria|PA|-1.75974|-46.5459
4303004|cachoeira do sul|RS|-30.033|-52.8928
2503308|cachoeira dos indios|PB|-6.91353|-38.676
5204250|cachoeira dourada|GO|-18.4859|-49.4766
3109808|cachoeira dourada|MG|-18.5161|-49.5039
2102374|cachoeira grande|MA|-2.93074|-44.0528
3508603|cachoeira paulista|SP|-22.6665|-45.0154
3300803|cachoeiras de macacu|RJ|-22.4658|-42.6523
1703826|cachoeirinha|TO|-6.1156|-47.9234
2603108|cachoeirinha|PE|-8.48668|-36.2402
4303103|cachoeirinha|RS|-29.9472|-51.1016
3201209|cachoeiro de itapemirim|ES|-20.8462|-41.1198
2503407|cacimba de areia|PB|-7.12128|-37.1563
2503506|cacimba de dentro|PB|-6.6386|-35.7778
2503555|cacimbas|PB|-7.20721|-37.0604
2701209|cacimbinhas|AL|-9.40121|-36.9911
4303202|cacique doble|RS|-27.767|-51.6597
1100049|cacoal|RO|-11.4343|-61.4562
3508702|caconde|SP|-21.528|-46.6437
5204300|cacu|GO|-18.5594|-51.1328
2905008|cacule|BA|-14.5003|-42.2229
2905107|caem|BA|-11.0677|-40.432
3109907|caetanopolis|MG|-19.2971|-44.4189
2905156|caetanos|BA|-14.3347|-40.9175
3110004|caete|MG|-19.8826|-43.6704
2603207|caetes|PE|-8.7803|-36.6268
2905206|caetite|BA|-14.0684|-42.4861
2905305|cafarnaum|BA|-11.6914|-41.4688
4103404|cafeara|PR|-22.789|-51.7142
3508801|cafelandia|SP|-21.8031|-49.6092
4103453|cafelandia|PR|-24.6189|-53.3207
4103479|cafezal do sul|PR|-23.9005|-53.5124
3508900|caiabu|SP|-22.0127|-51.2394
3110103|caiana|MG|-20.6956|-41.9292
5204409|caiaponia|GO|-16.9539|-51.8091
4303301|caibate|RS|-28.2905|-54.6454
4203105|caibi|SC|-27.0741|-53.2458
4303400|caicara|RS|-27.2791|-53.4257
2503605|caicara|PB|-6.62115|-35.4581
2401859|caicara do norte|RN|-5.07091|-36.0717
2401909|caicara do rio do vento|RN|-5.76541|-35.9938
2402006|caico|RN|-6.45441|-37.1067
3509007|caieiras|SP|-23.3607|-46.7397
2905404|cairu|BA|-13.4904|-39.0465
3509106|caiua|SP|-21.8322|-51.9969
3509205|cajamar|SP|-23.355|-46.8781
2102408|cajapio|MA|-2.87326|-44.6741
2102507|cajari|MA|-3.32742|-45.0145
3509254|cajati|SP|-24.7324|-48.1223
2503704|cajazeiras|PB|-6.88004|-38.5577
2202075|cajazeiras do piaui|PI|-6.79667|-42.3903
2503753|cajazeirinhas|PB|-6.96016|-37.8009
3509304|cajobi|SP|-20.8773|-48.8063
2701308|cajueiro|AL|-9.3994|-36.1559
2202083|cajueiro da praia|PI|-2.93111|-41.3408
3110202|cajuri|MG|-20.7903|-42.7925
3509403|cajuru|SP|-21.2749|-47.303
2603306|calcado|PE|-8.73108|-36.3366
1600204|calcoene|AP|2.50475|-50.9512
3110301|caldas|MG|-21.9183|-46.3843
2503803|caldas brandao|PB|-7.1025|-35.3272
5204508|caldas novas|GO|-17.7441|-48.6246
5204557|caldazinha|GO|-16.7117|-49.0013
2905503|caldeirao grande|BA|-11.0208|-40.2956
2202091|caldeirao grande do piaui|PI|-7.3314|-40.6366
4103503|california|PR|-23.6566|-51.3574
4203154|calmon|SC|-26.5942|-51.095
2603405|calumbi|PE|-7.93551|-38.1482
2905602|camacan|BA|-15.4142|-39.4919
2905701|camacari|BA|-12.6996|-38.3263
3110400|camacho|MG|-20.6294|-45.1593
2503902|camalau|PB|-7.88503|-36.8242
2905800|camamu|BA|-13.9398|-39.1071
3110509|camanducaia|MG|-22.7515|-46.1494
5002605|camapua|MS|-19.5347|-54.0431
4303509|camaqua|RS|-30.8489|-51.8043
2603454|camaragibe|PE|-8.02351|-34.9782
4303558|camargo|RS|-28.588|-52.2003
4103602|cambara|PR|-23.0423|-50.0753
4303608|cambara do sul|RS|-29.0474|-50.1465
4103701|cambe|PR|-23.2766|-51.2798
4103800|cambira|PR|-23.589|-51.5792
4203204|camboriu|SC|-27.0241|-48.6503
3300902|cambuci|RJ|-21.5691|-41.9187
3110608|cambui|MG|-22.6115|-46.0572
3110707|cambuquira|MG|-21.854|-45.2896
1502103|cameta|PA|-2.24295|-49.4979
2302602|camocim|CE|-2.9005|-40.8544
2603504|camocim de sao felix|PE|-8.35865|-35.7653
3110806|campanario|MG|-18.2427|-41.7355
3110905|campanha|MG|-21.836|-45.4004
3111002|campestre|MG|-21.7079|-46.2381
2701357|campestre|AL|-8.84723|-35.5685
4303673|campestre da serra|RS|-28.7926|-51.0941
5204607|campestre de goias|GO|-16.7624|-49.695
2102556|campestre do maranhao|MA|-6.17075|-47.3625
4103909|campina da lagoa|PR|-24.5893|-52.7976
4303707|campina das missoes|RS|-27.9888|-54.8416
3509452|campina do monte alegre|SP|-23.5895|-48.4758
4103958|campina do simao|PR|-25.0802|-51.8237
2504009|campina grande|PB|-7.22196|-35.8731
4104006|campina grande do sul|PR|-25.3044|-49.0551
3111101|campina verde|MG|-19.5382|-49.4862
5204656|campinacu|GO|-13.787|-48.5704
5102603|campinapolis|MT|-14.5162|-52.893
3509502|campinas|SP|-22.9053|-47.0659
2202109|campinas do piaui|PI|-7.6593|-41.8775
4303806|campinas do sul|RS|-27.7174|-52.6248
5204706|campinorte|GO|-14.3137|-49.1511
4203303|campo alegre|SC|-26.195|-49.2676
2701407|campo alegre|AL|-9.78451|-36.3525
5204805|campo alegre de goias|GO|-17.6363|-47.7768
2905909|campo alegre de lourdes|BA|-9.52221|-43.0126
2202117|campo alegre do fidalgo|PI|-8.38236|-41.8344
3111150|campo azul|MG|-16.5028|-44.8096
3111200|campo belo|MG|-20.8932|-45.2699
4203402|campo belo do sul|SC|-27.8975|-50.7595
4303905|campo bom|RS|-29.6747|-51.0606
4104055|campo bonito|PR|-25.0294|-52.9939
2801009|campo do brito|SE|-10.7392|-37.4954
3111309|campo do meio|MG|-21.1127|-45.8273
4104105|campo do tenente|PR|-25.98|-49.6844
4203501|campo ere|SC|-26.3931|-53.0856
3111408|campo florido|MG|-19.7631|-48.5716
2906006|campo formoso|BA|-10.5105|-40.32
2701506|campo grande|AL|-9.95542|-36.7926
5002704|campo grande|MS|-20.4486|-54.6295
2202133|campo grande do piaui|PI|-7.12827|-41.0315
4104204|campo largo|PR|-25.4525|-49.529
2202174|campo largo do piaui|PI|-3.80441|-42.64
5204854|campo limpo de goias|GO|-16.2971|-49.0895
3509601|campo limpo paulista|SP|-23.2078|-46.7889
4104253|campo magro|PR|-25.3687|-49.4501
2202208|campo maior|PI|-4.8217|-42.1641
4104303|campo mourao|PR|-24.0463|-52.378
4304002|campo novo|RS|-27.6792|-53.8052
1100700|campo novo de rondonia|RO|-10.5712|-63.6266
5102637|campo novo do parecis|MT|-13.6587|-57.8907
2402105|campo redondo|RN|-6.23829|-36.1888
5102678|campo verde|MT|-15.545|-55.1626
3111507|campos altos|MG|-19.6914|-46.1725
5204904|campos belos|GO|-13.035|-46.7681
4304101|campos borges|RS|-28.8871|-53.0008
5102686|campos de julio|MT|-13.7242|-59.2858
3509700|campos do jordao|SP|-22.7296|-45.5833
3301009|campos dos goytacazes|RJ|-21.7622|-41.3181
3111606|campos gerais|MG|-21.237|-45.7569
1703842|campos lindos|TO|-7.98956|-46.8645
4203600|campos novos|SC|-27.4002|-51.2276
3509809|campos novos paulista|SP|-22.602|-49.9987
2302701|campos sales|CE|-7.06761|-40.3687
5204953|campos verdes|GO|-14.2442|-49.6528
2603603|camutanga|PE|-7.40545|-35.2664
3111903|cana verde|MG|-21.0232|-45.1801
3111705|canaa|MG|-20.6869|-42.6167
1502152|canaa dos carajas|PA|-6.49659|-49.8776
5102694|canabrava do norte|MT|-11.0556|-51.8209
3509908|cananeia|SP|-25.0144|-47.9341
2701605|canapi|AL|-9.11932|-37.5967
2906105|canapolis|BA|-13.0725|-44.201
3111804|canapolis|MG|-18.7212|-49.2035
2906204|canarana|BA|-11.6858|-41.7677
5102702|canarana|MT|-13.5515|-52.2705
3509957|canas|SP|-22.7003|-45.0521
2202251|canavieira|PI|-7.68821|-43.7233
2906303|canavieiras|BA|-15.6722|-38.9536
2906402|candeal|BA|-11.8049|-39.1203
2906501|candeias|BA|-12.6716|-38.5472
3112000|candeias|MG|-20.7692|-45.2765
1100809|candeias do jamari|RO|-8.7907|-63.7005
4304200|candelaria|RS|-29.6684|-52.7895
2906600|candiba|BA|-14.4097|-42.8667
4104402|candido de abreu|PR|-24.5649|-51.3372
4304309|candido godoi|RS|-27.9515|-54.7517
2102606|candido mendes|MA|-1.43265|-45.7161
3510005|candido mota|SP|-22.7471|-50.3873
3510104|candido rodrigues|SP|-21.3275|-48.6327
2906709|candido sales|BA|-15.4993|-41.2414
4304358|candiota|RS|-31.5516|-53.6773
4104428|candoi|PR|-25.5758|-52.0409
4304408|canela|RS|-29.356|-50.8119
4203709|canelinha|SC|-27.2616|-48.7658
2402204|canguaretama|RN|-6.37193|-35.1281
4304507|cangucu|RS|-31.396|-52.6783
2801108|canhoba|SE|-10.1365|-36.9806
2603702|canhotinho|PE|-8.87652|-36.1979
2302800|caninde|CE|-4.35162|-39.3155
2801207|caninde de sao francisco|SE|-9.64882|-37.7923
3510153|canitar|SP|-23.004|-49.7839
4304606|canoas|RS|-29.9128|-51.1857
4203808|canoinhas|SC|-26.1766|-50.395
2906808|cansancao|BA|-10.6647|-39.4944
1400175|canta|RR|2.60994|-60.6058
3301108|cantagalo|RJ|-21.9797|-42.3664
4104451|cantagalo|PR|-25.3734|-52.1198
3112059|cantagalo|MG|-18.5248|-42.6223
2102705|cantanhede|MA|-3.63757|-44.383
2202307|canto do buriti|PI|-8.1111|-42.9517
2906824|canudos|BA|-9.90014|-39.1471
4304614|canudos do vale|RS|-29.3271|-52.2374
1300904|canutama|AM|-6.52582|-64.3953
1502202|capanema|PA|-1.20529|-47.1778
4104501|capanema|PR|-25.6691|-53.8055
4203253|capao alto|SC|-27.9389|-50.5098
3510203|capao bonito|SP|-24.0113|-48.3482
4304622|capao bonito do sul|RS|-28.1254|-51.3961
4304630|capao da canoa|RS|-29.7642|-50.0282
4304655|capao do cipo|RS|-28.9312|-54.5558
4304663|capao do leao|RS|-31.7565|-52.4889
3112109|caparao|MG|-20.5289|-41.9061
2701704|capela|AL|-9.41504|-36.0826
2801306|capela|SE|-10.5069|-37.0628
4304689|capela de santana|RS|-29.6961|-51.328
3510302|capela do alto|SP|-23.4685|-47.7388
2906857|capela do alto alegre|BA|-11.6658|-39.8349
3112208|capela nova|MG|-20.9179|-43.622
3112307|capelinha|MG|-17.6888|-42.5147
3112406|capetinga|MG|-20.6163|-47.0571
2504033|capim|PB|-6.91624|-35.1673
3112505|capim branco|MG|-19.5471|-44.1304
2906873|capim grosso|BA|-11.3797|-40.0089
3112604|capinopolis|MG|-18.6862|-49.5706
4203907|capinzal|SC|-27.3473|-51.6057
2102754|capinzal do norte|MA|-4.7236|-44.328
2302909|capistrano|CE|-4.45569|-38.9048
4304697|capitao|RS|-29.2674|-51.9853
3112653|capitao andrade|MG|-19.0748|-41.8614
2202406|capitao de campos|PI|-4.457|-41.944
3112703|capitao eneas|MG|-16.3265|-43.7084
2202455|capitao gervasio oliveira|PI|-8.49655|-41.814
4104600|capitao leonidas marques|PR|-25.4816|-53.6112
1502301|capitao poco|PA|-1.74785|-47.0629
3112802|capitolio|MG|-20.6164|-46.0493
3510401|capivari|SP|-22.9951|-47.5071
4203956|capivari de baixo|SC|-28.4498|-48.9631
4304671|capivari do sul|RS|-30.1383|-50.5152
1200179|capixaba|AC|-10.566|-67.686
2603801|capoeiras|PE|-8.73423|-36.6306
3112901|caputira|MG|-20.1703|-42.2683
4304713|caraa|RS|-29.7869|-50.4316
1400209|caracarai|RR|1.82766|-61.1304
2202505|caracol|PI|-9.27933|-43.329
5002803|caracol|MS|-22.011|-57.0277
3510500|caraguatatuba|SP|-23.6125|-45.4125
3113008|carai|MG|-17.1862|-41.7004
2906899|caraibas|BA|-14.7177|-41.2603
4104659|carambei|PR|-24.9152|-50.0986
3113107|caranaiba|MG|-20.8707|-43.7417
3113206|carandai|MG|-20.9566|-43.811
3113305|carangola|MG|-20.7343|-42.0313
3300936|carapebus|RJ|-22.1821|-41.663
3510609|carapicuiba|SP|-23.5235|-46.8407
3113404|caratinga|MG|-19.7868|-42.1292
1301001|carauari|AM|-4.88161|-66.9086
2402303|caraubas|RN|-5.78387|-37.5586
2504074|caraubas|PB|-7.72049|-36.492
2202539|caraubas do piaui|PI|-3.47525|-41.8425
2906907|caravelas|BA|-17.7268|-39.2597
4304705|carazinho|RS|-28.2958|-52.7933
3113503|carbonita|MG|-17.5255|-43.0137
2907004|cardeal da silva|BA|-11.9472|-37.9469
3510708|cardoso|SP|-20.08|-49.9183
3301157|cardoso moreira|RJ|-21.4846|-41.6165
3113602|careacu|MG|-22.0424|-45.696
1301100|careiro|AM|-3.76803|-60.369
1301159|careiro da varzea|AM|-3.314|-59.5557
3201308|cariacica|ES|-20.2632|-40.4165
2303006|caridade|CE|-4.22514|-39.1912
2202554|caridade do piaui|PI|-7.73435|-40.9848
2907103|carinhanha|BA|-14.2985|-43.7724
2801405|carira|SE|-10.3524|-37.7002
2303105|carire|CE|-3.94858|-40.476
1703867|cariri do tocantins|TO|-11.8881|-49.1609
2303204|caririacu|CE|-7.02808|-39.2828
2303303|carius|CE|-6.52428|-39.4916
5102793|carlinda|MT|-9.94912|-55.8417
4104709|carlopolis|PR|-23.4269|-49.7235
4304804|carlos barbosa|RS|-29.2969|-51.5028
3113701|carlos chagas|MG|-17.6973|-40.7723
4304853|carlos gomes|RS|-27.7167|-51.9121
3113800|carmesia|MG|-19.0877|-43.1382
3301207|carmo|RJ|-21.931|-42.6046
3113909|carmo da cachoeira|MG|-21.4633|-45.2201
3114006|carmo da mata|MG|-20.5575|-44.8735
3114105|carmo de minas|MG|-22.1204|-45.1307
3114204|carmo do cajuru|MG|-20.1912|-44.7664
3114303|carmo do paranaiba|MG|-18.991|-46.3167
3114402|carmo do rio claro|MG|-20.9736|-46.1149
5205000|carmo do rio verde|GO|-15.3549|-49.708
1703883|carmolandia|TO|-7.03262|-48.3978
2801504|carmopolis|SE|-10.6449|-36.9887
3114501|carmopolis de minas|MG|-20.5396|-44.6336
2603900|carnaiba|PE|-7.79342|-37.7946
2402402|carnauba dos dantas|RN|-6.55015|-36.5868
2402501|carnaubais|RN|-5.34181|-36.8335
2303402|carnaubal|CE|-4.15985|-40.9413
2603926|carnaubeira da penha|PE|-8.31799|-38.7512
3114550|carneirinho|MG|-19.6987|-50.6894
2701803|carneiros|AL|-9.48476|-37.3773
1400233|caroebe|RR|0.884203|-59.6959
2102804|carolina|MA|-7.33584|-47.4634
2604007|carpina|PE|-7.84566|-35.2514
3114600|carrancas|MG|-21.4898|-44.6446
2504108|carrapateira|PB|-7.03414|-38.3399
1703891|carrasco bonito|TO|-5.31415|-48.0314
2604106|caruaru|PE|-8.28455|-35.9699
2102903|carutapera|MA|-1.19696|-46.0085
3114709|carvalhopolis|MG|-21.7735|-45.8421
3114808|carvalhos|MG|-22.0|-44.4632
3510807|casa branca|SP|-21.7708|-47.0852
3114907|casa grande|MG|-20.7925|-43.9343
2907202|casa nova|BA|-9.16408|-40.974
4304903|casca|RS|-28.5605|-51.9815
3115003|cascalho rico|MG|-18.5772|-47.8716
4104808|cascavel|PR|-24.9573|-53.459
2303501|cascavel|CE|-4.12967|-38.2412
1703909|caseara|TO|-9.27612|-49.9521
4304952|caseiros|RS|-28.2582|-51.6861
3301306|casimiro de abreu|RJ|-22.4812|-42.2066
2604155|casinhas|PE|-7.74084|-35.7206
2504157|casserengue|PB|-6.77954|-35.8179
3115102|cassia|MG|-20.5831|-46.9201
3510906|cassia dos coqueiros|SP|-21.2801|-47.1643
5002902|cassilandia|MS|-19.1179|-51.7313
1502400|castanhal|PA|-1.29797|-47.9167
5102850|castanheira|MT|-11.1251|-58.6081
1100908|castanheiras|RO|-11.4253|-61.9482
5205059|castelandia|GO|-18.0921|-50.203
3201407|castelo|ES|-20.6033|-41.2031
2202604|castelo do piaui|PI|-5.31869|-41.5499
3511003|castilho|SP|-20.8689|-51.4884
4104907|castro|PR|-24.7891|-50.0108
2907301|castro alves|BA|-12.7579|-39.4248
3115300|cataguases|MG|-21.3924|-42.6896
5205109|catalao|GO|-18.1656|-47.944
3511102|catanduva|SP|-21.1314|-48.977
4105003|catanduvas|PR|-25.2044|-53.1548
4204004|catanduvas|SC|-27.069|-51.6602
2303600|catarina|CE|-6.12291|-39.8736
3115359|catas altas|MG|-20.0734|-43.4061
3115409|catas altas da noruega|MG|-20.6901|-43.4939
2604205|catende|PE|-8.67509|-35.7024
3511201|catigua|SP|-21.0519|-49.0616
2504207|catingueira|PB|-7.12008|-37.6064
2907400|catolandia|BA|-12.31|-44.8648
2504306|catole do rocha|PB|-6.34062|-37.747
2907509|catu|BA|-12.3513|-38.3791
4305009|catuipe|RS|-28.2554|-54.0132
3115458|catuji|MG|-17.3018|-41.5276
2303659|catunda|CE|-4.64336|-40.2
5205208|caturai|GO|-16.4447|-49.4936
2907558|caturama|BA|-13.3239|-42.2904
2504355|caturite|PB|-7.41659|-36.0306
3115474|catuti|MG|-15.3616|-42.9627
2303709|caucaia|CE|-3.72797|-38.6619
5205307|cavalcante|GO|-13.7976|-47.4566
3115508|caxambu|MG|-21.9753|-44.9319
4204103|caxambu do sul|SC|-27.1624|-52.8807
2103000|caxias|MA|-4.86505|-43.3617
4305108|caxias do sul|RS|-29.1629|-51.1792
2202653|caxingo|PI|-3.41904|-41.8955
2402600|ceara mirim|RN|-5.64323|-35.4247
2103109|cedral|MA|-2.00027|-44.5281
3511300|cedral|SP|-20.9009|-49.2664
2303808|cedro|CE|-6.60034|-39.0609
2604304|cedro|PE|-7.71179|-39.2367
2801603|cedro de sao joao|SE|-10.2534|-36.8856
3115607|cedro do abaete|MG|-19.1458|-45.712
4204152|celso ramos|SC|-27.6327|-51.335
4305116|centenario|RS|-27.7615|-51.9984
1704105|centenario|TO|-8.96103|-47.3304
4105102|centenario do sul|PR|-22.8188|-51.5973
2907608|central|BA|-11.1376|-42.1116
3115706|central de minas|MG|-18.7612|-41.3143
2103125|central do maranhao|MA|-2.19831|-44.8254
3115805|centralina|MG|-18.5852|-49.2014
2103158|centro do guilherme|MA|-2.44891|-46.0345
2103174|centro novo do maranhao|MA|-2.12696|-46.1228
1100056|cerejeiras|RO|-13.187|-60.8168
5205406|ceres|GO|-15.3061|-49.6
3511409|cerqueira cesar|SP|-23.038|-49.1655
3511508|cerquilho|SP|-23.1665|-47.7459
4305124|cerrito|RS|-31.8419|-52.8004
4105201|cerro azul|PR|-26.0891|-52.8691
4305132|cerro branco|RS|-29.657|-52.9406
2402709|cerro cora|RN|-6.03503|-36.3503
4305157|cerro grande|RS|-27.6106|-53.1672
4305173|cerro grande do sul|RS|-30.5905|-51.7418
4305207|cerro largo|RS|-28.1463|-54.7428
4204178|cerro negro|SC|-27.7942|-50.8673
3511607|cesario lange|SP|-23.226|-47.9545
4105300|ceu azul|PR|-25.1489|-53.8415
5205455|cezarina|GO|-16.9718|-49.7758
2604403|cha de alegria|PE|-8.00679|-35.204
2604502|cha grande|PE|-8.23827|-35.4571
2701902|cha preta|AL|-9.2556|-36.2983
3115904|chacara|MG|-21.6733|-43.215
3116001|chale|MG|-20.0453|-41.6897
4305306|chapada|RS|-28.0559|-53.0665
1705102|chapada da natividade|TO|-11.6175|-47.7486
1704600|chapada de areia|TO|-10.1419|-49.1403
3116100|chapada do norte|MG|-17.0881|-42.5392
5103007|chapada dos guimaraes|MT|-15.4643|-55.7499
3116159|chapada gaucha|MG|-15.3014|-45.6116
5205471|chapadao do ceu|GO|-18.4073|-52.549
4204194|chapadao do lageado|SC|-27.5905|-49.5539
5002951|chapadao do sul|MS|-18.788|-52.6263
2103208|chapadinha|MA|-3.73875|-43.3538
4204202|chapeco|SC|-27.1004|-52.6152
3511706|charqueada|SP|-22.5096|-47.7755
4305355|charqueadas|RS|-29.9625|-51.6289
4305371|charrua|RS|-27.9493|-52.015
2303907|chaval|CE|-3.03571|-41.2435
3557204|chavantes|SP|-23.0366|-49.7096
1502509|chaves|PA|-0.164154|-49.987
3116209|chiador|MG|-21.9996|-43.0617
4305405|chiapetta|RS|-27.923|-53.9419
4105409|chopinzinho|PR|-25.8515|-52.5173
2303931|choro|CE|-4.83906|-39.1344
2303956|chorozinho|CE|-4.28873|-38.4986
2907707|chorrocho|BA|-8.9695|-39.0979
4305439|chui|RS|-33.6866|-53.4594
1100924|chupinguaia|RO|-12.5611|-60.8877
4305447|chuvisca|RS|-30.7504|-51.9737
4105508|cianorte|PR|-23.6599|-52.6054
2907806|cicero dantas|BA|-10.5897|-38.3794
4105607|cidade gaucha|PR|-23.3772|-52.9436
5205497|cidade ocidental|GO|-16.0765|-47.9252
2103257|cidelandia|MA|-5.17465|-47.7781
4305454|cidreira|RS|-30.1604|-50.2337
2907905|cipo|BA|-11.1032|-38.5179
3116308|cipotanea|MG|-20.9026|-43.3629
4305504|ciriaco|RS|-28.3419|-51.8741
3116407|claraval|MG|-20.397|-47.2768
3116506|claro dos pocoes|MG|-17.082|-44.2061
5103056|claudia|MT|-11.5075|-54.8835
3116605|claudio|MG|-20.4437|-44.7673
3511904|clementina|SP|-21.5604|-50.4525
4105706|clevelandia|PR|-26.4043|-52.3508
2908002|coaraci|BA|-14.637|-39.5556
1301209|coari|AM|-4.09412|-63.1441
2202703|cocal|PI|-3.47279|-41.5546
2202711|cocal de telha|PI|-4.5571|-41.9587
4204251|cocal do sul|SC|-28.5986|-49.3335
2202729|cocal dos alves|PI|-3.62047|-41.4402
5103106|cocalinho|MT|-14.3903|-51.0001
5205513|cocalzinho de goias|GO|-15.7914|-48.7747
2908101|cocos|BA|-14.1814|-44.5352
1301308|codajas|AM|-3.83053|-62.0658
2103307|codo|MA|-4.45562|-43.8924
2103406|coelho neto|MA|-4.25245|-43.0108
3116704|coimbra|MG|-20.8535|-42.8008
2702009|coite do noia|AL|-9.63348|-36.5845
2202737|coivaras|PI|-5.09224|-42.208
1502608|colares|PA|-0.936423|-48.2803
3201506|colatina|ES|-19.5493|-40.6269
5103205|colider|MT|-10.8135|-55.461
3512001|colina|SP|-20.7114|-48.5387
4305587|colinas|RS|-29.3948|-51.8556
2103505|colinas|MA|-6.03199|-44.2543
5205521|colinas do sul|GO|-14.1528|-48.076
1705508|colinas do tocantins|TO|-8.05764|-48.4757
1716703|colmeia|TO|-8.72463|-48.7638
5103254|colniza|MT|-9.46121|-59.2252
3512100|colombia|SP|-20.1768|-48.6865
4105805|colombo|PR|-25.2925|-49.2262
2202752|colonia do gurgueia|PI|-8.1837|-43.794
2202778|colonia do piaui|PI|-7.22651|-42.1756
2702108|colonia leopoldina|AL|-8.91806|-35.7214
4305603|colorado|RS|-28.5258|-52.9928
4105904|colorado|PR|-22.8374|-51.9743
1100064|colorado do oeste|RO|-13.1174|-60.5454
3116803|coluna|MG|-18.2311|-42.8352
1705557|combinado|TO|-12.7917|-46.5388
3116902|comendador gomes|MG|-19.6973|-49.0789
3300951|comendador levy gasparian|RJ|-22.0404|-43.214
3117009|comercinho|MG|-16.2963|-41.7945
5103304|comodoro|MT|-13.6614|-59.7848
2504405|conceicao|PB|-7.55106|-38.5014
3117108|conceicao da aparecida|MG|-21.096|-46.2049
3201605|conceicao da barra|ES|-18.5883|-39.7362
3115201|conceicao da barra de minas|MG|-21.1316|-44.4729
2908200|conceicao da feira|BA|-12.5078|-38.9978
3117306|conceicao das alagoas|MG|-19.9172|-48.3839
3117207|conceicao das pedras|MG|-22.1576|-45.4562
3117405|conceicao de ipanema|MG|-19.9326|-41.6908
3301405|conceicao de macabu|RJ|-22.0834|-41.8719
2908309|conceicao do almeida|BA|-12.7836|-39.1715
1502707|conceicao do araguaia|PA|-8.26136|-49.2689
2202802|conceicao do caninde|PI|-7.87638|-41.5942
3201704|conceicao do castelo|ES|-20.3639|-41.2417
2908408|conceicao do coite|BA|-11.56|-39.2808
2908507|conceicao do jacuipe|BA|-12.3268|-38.7684
2103554|conceicao do lago acu|MA|-3.85142|-44.8895
3117504|conceicao do mato dentro|MG|-19.0344|-43.4221
3117603|conceicao do para|MG|-19.7456|-44.8945
3117702|conceicao do rio verde|MG|-21.8778|-45.087
1705607|conceicao do tocantins|TO|-12.2209|-47.2951
3117801|conceicao dos ouros|MG|-22.4078|-45.7996
3512209|conchal|SP|-22.3375|-47.1729
3512308|conchas|SP|-23.0154|-48.0134
4204301|concordia|SC|-27.2335|-52.026
1502756|concordia do para|PA|-1.99238|-47.9422
2504504|condado|PB|-6.89831|-37.606
2604601|condado|PE|-7.58787|-35.0999
2504603|conde|PB|-7.25746|-34.8999
2908606|conde|BA|-11.8179|-37.6131
2908705|condeuba|BA|-14.9022|-41.9718
4305702|condor|RS|-28.2075|-53.4905
3117836|conego marinho|MG|-15.2892|-44.4181
3117876|confins|MG|-19.6282|-43.9931
5103353|confresa|MT|-10.6437|-51.5699
2504702|congo|PB|-7.79078|-36.6581
3117900|congonhal|MG|-22.1488|-46.043
3118007|congonhas|MG|-20.4958|-43.851
3118106|congonhas do norte|MG|-18.8021|-43.6767
4106001|congonhinhas|PR|-23.5493|-50.5569
3118205|conquista|MG|-19.9312|-47.5492
5103361|conquista d oeste|MT|-14.5381|-59.5444
3118304|conselheiro lafaiete|MG|-20.6634|-43.7846
4106100|conselheiro mairinck|PR|-23.623|-50.1707
3118403|conselheiro pena|MG|-19.1789|-41.4736
3118502|consolacao|MG|-22.5493|-45.9255
4305801|constantina|RS|-27.732|-52.9938
3118601|contagem|MG|-19.9321|-44.0539
4106209|contenda|PR|-25.6788|-49.535
2908804|contendas do sincora|BA|-13.7537|-41.048
3118700|coqueiral|MG|-21.1858|-45.4366
4305835|coqueiro baixo|RS|-29.1802|-52.0942
2702207|coqueiro seco|AL|-9.63715|-35.7994
4305850|coqueiros do sul|RS|-28.1194|-52.7842
3118809|coracao de jesus|MG|-16.6841|-44.3635
2908903|coracao de maria|BA|-12.2333|-38.7487
4106308|corbelia|PR|-24.7971|-53.3006
3301504|cordeiro|RJ|-22.0267|-42.3648
3512407|cordeiropolis|SP|-22.4778|-47.4519
2909000|cordeiros|BA|-15.0356|-41.9308
4204350|cordilheira alta|SC|-26.9844|-52.6056
3118908|cordisburgo|MG|-19.1224|-44.3224
3119005|cordislandia|MG|-21.7891|-45.6999
2304004|coreau|CE|-3.5415|-40.6587
2504801|coremas|PB|-7.00712|-37.9346
5003108|corguinho|MS|-19.8243|-54.8281
2909109|coribe|BA|-13.8232|-44.4586
3119104|corinto|MG|-18.369|-44.4542
4106407|cornelio procopio|PR|-23.1829|-50.6498
3119203|coroaci|MG|-18.6156|-42.2791
3512506|coroados|SP|-21.3521|-50.2859
2103604|coroata|MA|-4.13442|-44.1244
3119302|coromandel|MG|-18.4734|-47.1933
4305871|coronel barros|RS|-28.3921|-54.0686
4305900|coronel bicaco|RS|-27.7197|-53.7022
4106456|coronel domingos soares|PR|-26.2277|-52.0356
2402808|coronel ezequiel|RN|-6.3748|-36.2223
3119401|coronel fabriciano|MG|-19.5179|-42.6276
4204400|coronel freitas|SC|-26.9057|-52.7011
2402907|coronel joao pessoa|RN|-6.24974|-38.4441
2909208|coronel joao sa|BA|-10.2847|-37.9198
2202851|coronel jose dias|PI|-8.81397|-42.5232
3512605|coronel macedo|SP|-23.6261|-49.31
4204459|coronel martins|SC|-26.511|-52.6694
3119500|coronel murta|MG|-16.6148|-42.184
3119609|coronel pacheco|MG|-21.5898|-43.256
4305934|coronel pilar|RS|-29.2695|-51.6847
5003157|coronel sapucaia|MS|-23.2724|-55.5278
4106506|coronel vivida|PR|-25.9767|-52.5641
3119708|coronel xavier chaves|MG|-21.0277|-44.2206
3119807|corrego danta|MG|-19.8198|-45.9032
3119906|corrego do bom jesus|MG|-22.6269|-46.0241
5205703|corrego do ouro|GO|-16.2918|-50.5503
3119955|corrego fundo|MG|-20.4474|-45.5617
3120003|corrego novo|MG|-19.8361|-42.3988
4204558|correia pinto|SC|-27.5877|-50.3614
2202901|corrente|PI|-10.4333|-45.1633
2604700|correntes|PE|-9.12117|-36.3244
2909307|correntina|BA|-13.3477|-44.6333
2604809|cortes|PE|-8.47443|-35.5468
5003207|corumba|MS|-19.0077|-57.651
5205802|corumba de goias|GO|-15.9245|-48.8117
5205901|corumbaiba|GO|-18.1415|-48.5626
3512704|corumbatai|SP|-22.2213|-47.6215
4106555|corumbatai do sul|PR|-24.101|-52.1177
1100072|corumbiara|RO|-12.9551|-60.8947
4204509|corupa|SC|-26.4246|-49.246
2702306|coruripe|AL|-10.1276|-36.1717
3512803|cosmopolis|SP|-22.6419|-47.1926
3512902|cosmorama|SP|-20.4755|-49.7827
1100080|costa marques|RO|-12.4367|-64.228
5003256|costa rica|MS|-18.5432|-53.1287
2909406|cotegipe|BA|-12.0228|-44.2566
3513009|cotia|SP|-23.6022|-46.919
4305959|cotipora|RS|-28.9891|-51.6971
5103379|cotriguacu|MT|-9.85656|-58.4192
3120102|couto de magalhaes de minas|MG|-18.0727|-43.4648
1706001|couto magalhaes|TO|-8.28411|-49.2473
4305975|coxilha|RS|-28.128|-52.3023
5003306|coxim|MS|-18.5013|-54.751
2504850|coxixola|PB|-7.62365|-36.6064
2702355|craibas|AL|-9.6178|-36.7697
2304103|crateus|CE|-5.16768|-40.6536
2304202|crato|CE|-7.2153|-39.4103
3513108|cravinhos|SP|-21.338|-47.7324
2909505|cravolandia|BA|-13.3531|-39.8031
4204608|criciuma|SC|-28.6723|-49.3729
3120151|crisolita|MG|-17.2381|-40.9184
2909604|crisopolis|BA|-11.5059|-38.1515
4306007|crissiumal|RS|-27.4999|-54.0994
3120201|cristais|MG|-20.8733|-45.5167
3513207|cristais paulista|SP|-20.4036|-47.4209
4306056|cristal|RS|-31.0046|-52.0436
4306072|cristal do sul|RS|-27.452|-53.2422
1706100|cristalandia|TO|-10.5985|-49.1942
2203008|cristalandia do piaui|PI|-10.6443|-45.1893
3120300|cristalia|MG|-16.716|-42.8571
5206206|cristalina|GO|-16.7676|-47.6131
3120409|cristiano otoni|MG|-20.8324|-43.8166
5206305|cristianopolis|GO|-17.1987|-48.7034
3120508|cristina|MG|-22.208|-45.2673
2801702|cristinapolis|SE|-11.4668|-37.7585
2203107|cristino castro|PI|-8.82273|-44.223
2909703|cristopolis|BA|-12.2249|-44.4214
5206404|crixas|GO|-14.5412|-49.974
1706258|crixas do tocantins|TO|-11.0994|-48.9152
2304236|croata|CE|-4.40481|-40.9022
5206503|crominia|GO|-17.2883|-49.3798
3120607|crucilandia|MG|-20.3923|-44.3334
2304251|cruz|CE|-2.91813|-40.176
4306106|cruz alta|RS|-28.645|-53.6048
2909802|cruz das almas|BA|-12.6675|-39.1008
2504900|cruz do espirito santo|PB|-7.13902|-35.0857
4106803|cruz machado|PR|-26.0166|-51.343
3513306|cruzalia|SP|-22.7373|-50.7909
4306130|cruzaltense|RS|-27.6672|-52.6522
3513405|cruzeiro|SP|-22.5728|-44.969
3120706|cruzeiro da fortaleza|MG|-18.944|-46.6669
4106571|cruzeiro do iguacu|PR|-25.6192|-53.1285
4106605|cruzeiro do oeste|PR|-23.7799|-53.0774
4106704|cruzeiro do sul|PR|-22.9624|-52.1622
4306205|cruzeiro do sul|RS|-29.5148|-51.9928
1200203|cruzeiro do sul|AC|-7.62762|-72.6756
2403004|cruzeta|RN|-6.40894|-36.7782
3120805|cruzilia|MG|-21.84|-44.8067
4106852|cruzmaltina|PR|-24.0132|-51.4563
3513504|cubatao|SP|-23.8911|-46.424
2505006|cubati|PB|-6.86686|-36.3619
5103403|cuiaba|MT|-15.601|-56.0974
2505105|cuite|PB|-6.47647|-36.1515
2505238|cuite de mamanguape|PB|-6.91292|-35.2502
2505204|cuitegi|PB|-6.89058|-35.5215
1100940|cujubim|RO|-9.36065|-62.5846
5206602|cumari|GO|-18.2644|-48.1511
2604908|cumaru|PE|-8.00827|-35.6957
1502764|cumaru do norte|PA|-7.81097|-50.7698
2801900|cumbe|SE|-10.352|-37.1846
3513603|cunha|SP|-23.0731|-44.9576
4204707|cunha pora|SC|-26.895|-53.1662
4204756|cunhatai|SC|-26.9709|-53.0895
3120839|cuparaque|MG|-18.9648|-41.0986
2605004|cupira|PE|-8.62432|-35.9518
2909901|curaca|BA|-8.98458|-39.8997
2203206|curimata|PI|-10.0326|-44.3002
1502772|curionopolis|PA|-6.09965|-49.6068
4106902|curitiba|PR|-25.4195|-49.2646
4204806|curitibanos|SC|-27.2824|-50.5816
4107009|curiuva|PR|-24.0362|-50.4576
2203230|currais|PI|-9.01175|-44.4062
2403103|currais novos|RN|-6.25484|-36.5146
2505279|curral de cima|PB|-6.72325|-35.2639
3120870|curral de dentro|MG|-15.9327|-41.8557
2203271|curral novo do piaui|PI|-7.8313|-40.8957
2505303|curral velho|PB|-7.53075|-38.1962
1502806|curralinho|PA|-1.81179|-49.7952
2203255|curralinhos|PI|-5.60825|-42.8376
1502855|curua|PA|-1.88775|-55.1168
1502905|curuca|PA|-0.733214|-47.8515
2103703|cururupu|MA|-1.81475|-44.8644
5103437|curvelandia|MT|-15.6084|-57.9133
3120904|curvelo|MG|-18.7527|-44.4303
2605103|custodia|PE|-8.08546|-37.6443
1600212|cutias|AP|0.970761|-50.8005
5206701|damianopolis|GO|-14.5604|-46.178
2505352|damiao|PB|-6.63161|-35.9101
5206800|damolandia|GO|-16.2544|-49.3631
1706506|darcinopolis|TO|-6.71591|-47.7597
2910008|dario meira|BA|-14.4229|-39.9031
3121001|datas|MG|-18.4478|-43.6591
4306304|david canabarro|RS|-28.3849|-51.8482
2103752|davinopolis|MA|-5.54637|-47.4217
5206909|davinopolis|GO|-18.1501|-47.5568
3121100|delfim moreira|MG|-22.5036|-45.2792
3121209|delfinopolis|MG|-20.3468|-46.8456
2702405|delmiro gouveia|AL|-9.38534|-37.9987
3121258|delta|MG|-19.9721|-47.7841
2203305|demerval lobao|PI|-5.35875|-42.6776
5103452|denise|MT|-14.7324|-57.0583
5003454|deodapolis|MS|-22.2763|-54.1682
2304269|deputado irapuan pinheiro|CE|-5.91485|-39.257
4306320|derrubadas|RS|-27.2642|-53.8645
3513702|descalvado|SP|-21.9002|-47.6181
4204905|descanso|SC|-26.827|-53.5034
3121308|descoberto|MG|-21.46|-42.9618
2505402|desterro|PB|-7.287|-37.0925
3121407|desterro de entre rios|MG|-20.665|-44.3334
3121506|desterro do melo|MG|-21.143|-43.5178
4306353|dezesseis de novembro|RS|-28.219|-55.0617
3513801|diadema|SP|-23.6813|-46.6205
2505600|diamante|PB|-7.41738|-38.2615
4107157|diamante d oeste|PR|-24.9419|-54.1052
4107108|diamante do norte|PR|-22.655|-52.8617
4107124|diamante do sul|PR|-25.035|-52.6768
3121605|diamantina|MG|-18.2413|-43.6031
5103502|diamantino|MT|-14.4037|-56.4366
1707009|dianopolis|TO|-11.624|-46.8198
2910057|dias d avila|BA|-12.6187|-38.2926
4306379|dilermando de aguiar|RS|-29.7054|-54.2122
3121704|diogo de vasconcelos|MG|-20.4879|-43.1953
3121803|dionisio|MG|-19.8433|-42.7701
4205001|dionisio cerqueira|SC|-26.2648|-53.6351
5207105|diorama|GO|-16.2329|-51.2543
3513850|dirce reis|SP|-20.4642|-50.6073
2203354|dirceu arcoverde|PI|-9.33939|-42.4348
2802007|divina pastora|SE|-10.6782|-37.1506
3121902|divinesia|MG|-20.9917|-43.0003
3122009|divino|MG|-20.6134|-42.1438
3122108|divino das laranjeiras|MG|-18.7755|-41.4781
3201803|divino de sao lourenco|ES|-20.6229|-41.6937
3513900|divinolandia|SP|-21.6637|-46.7361
3122207|divinolandia de minas|MG|-18.8004|-42.6103
3122306|divinopolis|MG|-20.1446|-44.8912
5208301|divinopolis de goias|GO|-13.2853|-46.3999
1707108|divinopolis do tocantins|TO|-9.80018|-49.2169
3122355|divisa alegre|MG|-15.7221|-41.3463
3122405|divisa nova|MG|-21.5092|-46.1904
3122454|divisopolis|MG|-15.7254|-40.9997
3514007|dobrada|SP|-21.5155|-48.3935
3514106|dois corregos|SP|-22.3673|-48.3819
4306403|dois irmaos|RS|-29.5836|-51.0898
4306429|dois irmaos das missoes|RS|-27.6621|-53.5304
5003488|dois irmaos do buriti|MS|-20.6848|-55.2915
1707207|dois irmaos do tocantins|TO|-9.25534|-49.0638
4306452|dois lajeados|RS|-28.983|-51.8396
2702504|dois riachos|AL|-9.38465|-37.0965
4107207|dois vizinhos|PR|-25.7407|-53.057
3514205|dolcinopolis|SP|-20.124|-50.5149
5103601|dom aquino|MT|-15.8099|-54.9223
2910107|dom basilio|BA|-13.7565|-41.7677
3122470|dom bosco|MG|-16.652|-46.2597
3122504|dom cavati|MG|-19.3735|-42.1121
1502939|dom eliseu|PA|-4.19944|-47.8245
2203404|dom expedito lopes|PI|-6.95332|-41.6396
4306502|dom feliciano|RS|-30.7004|-52.1026
2203453|dom inocencio|PI|-9.00516|-41.9697
3122603|dom joaquim|MG|-18.961|-43.2544
2910206|dom macedo costa|BA|-12.9016|-39.1923
4306601|dom pedrito|RS|-30.9756|-54.6694
2103802|dom pedro|MA|-5.03518|-44.4409
4306551|dom pedro de alcantara|RS|-29.3639|-49.853
3122702|dom silverio|MG|-20.1627|-42.9627
3122801|dom vicoso|MG|-22.2511|-45.1643
3201902|domingos martins|ES|-20.3603|-40.6594
2203420|domingos mourao|PI|-4.2495|-41.2683
4205100|dona emma|SC|-26.981|-49.7261
3122900|dona eusebia|MG|-21.319|-42.807
4306700|dona francisca|RS|-29.6195|-53.3617
2505709|dona ines|PB|-6.61566|-35.6205
3123007|dores de campos|MG|-21.1139|-44.0207
3123106|dores de guanhaes|MG|-19.0516|-42.9254
3123205|dores do indaia|MG|-19.4628|-45.5927
3202009|dores do rio preto|ES|-20.6931|-41.8405
3123304|dores do turvo|MG|-20.9785|-43.1834
3123403|doresopolis|MG|-20.2868|-45.9007
2605152|dormentes|PE|-8.44116|-40.7662
5003504|douradina|MS|-22.0405|-54.6158
4107256|douradina|PR|-23.3807|-53.2918
3514304|dourado|SP|-22.1044|-48.3178
3123502|douradoquara|MG|-18.4338|-47.5993
5003702|dourados|MS|-22.2231|-54.812
4107306|doutor camargo|PR|-23.5582|-52.2178
4306734|doutor mauricio cardoso|RS|-27.5103|-54.3577
4205159|doutor pedrinho|SC|-26.7174|-49.4795
4306759|doutor ricardo|RS|-29.084|-51.9972
2403202|doutor severiano|RN|-6.08082|-38.3794
4128633|doutor ulysses|PR|-24.5665|-49.4219
5207253|doverlandia|GO|-16.7188|-52.3189
3514403|dracena|SP|-21.4843|-51.535
3514502|duartina|SP|-22.4146|-49.4084
3301603|duas barras|RJ|-22.0536|-42.5232
2505808|duas estradas|PB|-6.68499|-35.418
1707306|duere|TO|-11.3416|-49.2716
3514601|dumont|SP|-21.2324|-47.9756
2103901|duque bacelar|MA|-4.15002|-42.9477
3301702|duque de caxias|RJ|-22.7858|-43.3049
3123528|durande|MG|-20.2058|-41.7977
3514700|echapora|SP|-22.4326|-50.2038
3202108|ecoporanga|ES|-18.3702|-40.836
5207352|edealina|GO|-17.4239|-49.6644
5207402|edeia|GO|-17.3406|-49.9295
1301407|eirunepe|AM|-6.65677|-69.8662
5003751|eldorado|MS|-23.7868|-54.2838
3514809|eldorado|SP|-24.5281|-48.1141
1502954|eldorado do carajas|PA|-6.10389|-49.3553
4306767|eldorado do sul|RS|-30.0847|-51.6187
2203503|elesbao veloso|PI|-6.19947|-42.1355
3514908|elias fausto|SP|-23.0428|-47.3682
2203602|eliseu martins|PI|-8.09629|-43.6705
3514924|elisiario|SP|-21.1678|-49.1146
2910305|elisio medrado|BA|-12.9417|-39.5191
3123601|eloi mendes|MG|-21.6088|-45.5691
2505907|emas|PB|-7.09964|-37.7163
3514957|embauba|SP|-20.9796|-48.8325
3515004|embu das artes|SP|-23.6437|-46.8579
3515103|embu guacu|SP|-23.8297|-46.8136
3515129|emilianopolis|SP|-21.8314|-51.4832
4306809|encantado|RS|-29.2351|-51.8703
2403301|encanto|RN|-6.10691|-38.3033
2910404|encruzilhada|BA|-15.5302|-40.9124
4306908|encruzilhada do sul|RS|-30.543|-52.5204
4107405|eneas marques|PR|-25.9445|-53.1659
4107504|engenheiro beltrao|PR|-23.797|-52.2659
3123700|engenheiro caldas|MG|-19.2065|-42.0503
3515152|engenheiro coelho|SP|-22.4836|-47.211
3123809|engenheiro navarro|MG|-17.2831|-43.947
3301801|engenheiro paulo de frontin|RJ|-22.5498|-43.6827
4306924|engenho velho|RS|-27.706|-52.9145
3123858|entre folhas|MG|-19.6218|-42.2306
2910503|entre rios|BA|-11.9392|-38.0871
4205175|entre rios|SC|-26.7225|-52.5585
3123908|entre rios de minas|MG|-20.6706|-44.0654
4107538|entre rios do oeste|PR|-24.7042|-54.2385
4306957|entre rios do sul|RS|-27.5298|-52.7347
4306932|entre ijuis|RS|-28.3686|-54.2686
1301506|envira|AM|-7.43789|-70.0281
1200252|epitaciolandia|AC|-11.0188|-68.7341
2403400|equador|RN|-6.93835|-36.717
4306973|erebango|RS|-27.8544|-52.3005
4307005|erechim|RS|-27.6364|-52.2697
2304277|erere|CE|-6.02751|-38.3461
2900504|erico cardoso|BA|-13.4215|-42.1352
4205191|ermo|SC|-28.9869|-49.643
4307054|ernestina|RS|-28.4977|-52.5836
4307203|erval grande|RS|-27.3926|-52.574
4307302|erval seco|RS|-27.5443|-53.5005
4205209|erval velho|SC|-27.2743|-51.443
3124005|ervalia|MG|-20.8403|-42.6544
2605202|escada|PE|-8.35672|-35.2241
4307401|esmeralda|RS|-28.0518|-51.1933
3124104|esmeraldas|MG|-19.764|-44.3065
3124203|espera feliz|MG|-20.6508|-41.9119
2506004|esperanca|PB|-7.02278|-35.8597
4307450|esperanca do sul|RS|-27.3603|-53.9891
4107520|esperanca nova|PR|-23.7238|-53.811
1707405|esperantina|TO|-5.36593|-48.5378
2203701|esperantina|PI|-3.88863|-42.2324
2104008|esperantinopolis|MA|-4.87938|-44.6926
4107546|espigao alto do iguacu|PR|-25.4216|-52.8348
1100098|espigao d oeste|RO|-11.5266|-61.0252
3124302|espinosa|MG|-14.9249|-42.809
2403509|espirito santo|RN|-6.33563|-35.3052
3124401|espirito santo do dourado|MG|-22.0454|-45.9548
3515186|espirito santo do pinhal|SP|-22.1909|-46.7477
3515194|espirito santo do turvo|SP|-22.6925|-49.4341
2910602|esplanada|BA|-11.7942|-37.9432
4307500|espumoso|RS|-28.7286|-52.8461
4307559|estacao|RS|-27.9135|-52.2635
2802106|estancia|SE|-11.2659|-37.4484
4307609|estancia velha|RS|-29.6535|-51.1843
4307708|esteio|RS|-29.852|-51.1841
3124500|estiva|MG|-22.4577|-46.0191
3557303|estiva gerbi|SP|-22.2713|-46.9481
2104057|estreito|MA|-6.56077|-47.4431
4307807|estrela|RS|-29.5002|-51.9495
3515202|estrela d oeste|SP|-20.2875|-50.4049
3124609|estrela dalva|MG|-21.7412|-42.4574
2702553|estrela de alagoas|AL|-9.39089|-36.7644
3124708|estrela do indaia|MG|-19.5169|-45.7859
5207501|estrela do norte|GO|-13.8665|-49.0716
3515301|estrela do norte|SP|-22.4859|-51.6632
3124807|estrela do sul|MG|-18.7399|-47.6956
4307815|estrela velha|RS|-29.1713|-53.1639
2910701|euclides da cunha|BA|-10.5078|-39.0153
3515350|euclides da cunha paulista|SP|-22.5545|-52.5928
4307831|eugenio de castro|RS|-28.5315|-54.1506
3124906|eugenopolis|MG|-21.1002|-42.1878
2910727|eunapolis|BA|-16.3715|-39.5821
2304285|eusebio|CE|-3.8925|-38.4559
3125002|ewbank da camara|MG|-21.5498|-43.5068
3125101|extrema|MG|-22.854|-46.3178
2403608|extremoz|RN|-5.70143|-35.3048
2605301|exu|PE|-7.50364|-39.7238
2506103|fagundes|PB|-7.34454|-35.7931
4307864|fagundes varela|RS|-28.8794|-51.7014
5207535|faina|GO|-15.4473|-50.3622
3125200|fama|MG|-21.4089|-45.8286
3125309|faria lemos|MG|-20.8097|-42.0213
2304301|farias brito|CE|-6.92146|-39.5651
1503002|faro|PA|-2.16805|-56.7405
4107553|farol|PR|-24.0958|-52.6217
4307906|farroupilha|RS|-29.2227|-51.3419
3515400|fartura|SP|-23.3916|-49.5124
2203750|fartura do piaui|PI|-9.48342|-42.7912
1707553|fatima|TO|-10.7603|-48.9076
2910750|fatima|BA|-10.616|-38.2239
5003801|fatima do sul|MS|-22.3789|-54.5131
4107603|faxinal|PR|-24.0077|-51.3227
4308003|faxinal do soturno|RS|-29.5788|-53.4484
4205308|faxinal dos guedes|SC|-26.8451|-52.2596
4308052|faxinalzinho|RS|-27.4238|-52.6789
5207600|fazenda nova|GO|-16.1834|-50.7781
4107652|fazenda rio grande|PR|-25.6624|-49.3073
4308078|fazenda vilanova|RS|-29.5885|-51.8217
1200302|feijo|AC|-8.17054|-70.351
2910776|feira da mata|BA|-14.2044|-44.2744
2910800|feira de santana|BA|-12.2664|-38.9663
2702603|feira grande|AL|-9.89859|-36.6815
2605400|feira nova|PE|-7.94704|-35.3801
2802205|feira nova|SE|-10.2616|-37.3147
2104073|feira nova do maranhao|MA|-6.96508|-46.6786
3125408|felicio dos santos|MG|-18.0755|-43.2422
2403707|felipe guerra|RN|-5.59274|-37.6875
3125606|felisburgo|MG|-16.6348|-40.7605
3125705|felixlandia|MG|-18.7507|-44.9004
4308102|feliz|RS|-29.4527|-51.3032
2702702|feliz deserto|AL|-10.2935|-36.3028
5103700|feliz natal|MT|-12.385|-54.9227
4107702|fenix|PR|-23.9135|-51.9805
4107736|fernandes pinheiro|PR|-25.4107|-50.5456
3125804|fernandes tourinho|MG|-19.1541|-42.0803
2605459|fernando de noronha|PE|-3.8396|-32.4107
2104081|fernando falcao|MA|-6.16207|-44.8979
2403756|fernando pedroza|RN|-5.69096|-36.5282
3515608|fernando prestes|SP|-21.2661|-48.6874
3515509|fernandopolis|SP|-20.2806|-50.2471
3515657|fernao|SP|-22.3607|-49.5187
3515707|ferraz de vasconcelos|SP|-23.5411|-46.371
1600238|ferreira gomes|AP|0.857256|-51.1795
2605509|ferreiros|PE|-7.44666|-35.2373
3125903|ferros|MG|-19.2343|-43.0192
3125952|fervedouro|MG|-20.726|-42.279
4107751|figueira|PR|-23.8455|-50.4031
5003900|figueirao|MS|-18.6782|-53.638
1707652|figueiropolis|TO|-12.1312|-49.1748
5103809|figueiropolis d oeste|MT|-15.4439|-58.7391
1707702|filadelfia|TO|-7.33501|-47.4954
2910859|filadelfia|BA|-10.7405|-40.1437
2910909|firmino alves|BA|-14.9823|-39.9269
5207808|firminopolis|GO|-16.5778|-50.304
2702801|flexeiras|AL|-9.27281|-35.7139
4107850|flor da serra do sul|PR|-26.2523|-53.3092
4205357|flor do sertao|SC|-26.7811|-53.3505
3515806|flora rica|SP|-21.6727|-51.3821
4107801|florai|PR|-23.3178|-52.3029
2403806|florania|RN|-6.12264|-36.8226
3515905|floreal|SP|-20.6752|-50.1513
2605608|flores|PE|-7.85842|-37.9715
4308201|flores da cunha|RS|-29.0261|-51.1875
5207907|flores de goias|GO|-14.4451|-47.0417
2203800|flores do piaui|PI|-7.78793|-42.918
4107900|floresta|PR|-23.6031|-52.0807
2605707|floresta|PE|-8.60307|-38.5687
2911006|floresta azul|BA|-14.8629|-39.6579
1503044|floresta do araguaia|PA|-7.55335|-49.7125
2203859|floresta do piaui|PI|-7.46682|-41.7883
3126000|florestal|MG|-19.888|-44.4318
4108007|florestopolis|PR|-22.8623|-51.3882
2203909|floriano|PI|-6.77182|-43.0241
4308250|floriano peixoto|RS|-27.8614|-52.0838
4205407|florianopolis|SC|-27.5945|-48.5477
4108106|florida|PR|-23.0847|-51.9546
3516002|florida paulista|SP|-21.6127|-51.1724
3516101|florinia|SP|-22.868|-50.6814
1301605|fonte boa|AM|-2.52342|-66.0942
4308300|fontoura xavier|RS|-28.9817|-52.3445
3126109|formiga|MG|-20.4618|-45.4268
4308409|formigueiro|RS|-30.0035|-53.4959
5208004|formosa|GO|-15.54|-47.337
2104099|formosa da serra negra|MA|-6.44017|-46.1916
4108205|formosa do oeste|PR|-24.2951|-53.3114
2911105|formosa do rio preto|BA|-11.0328|-45.193
4205431|formosa do sul|SC|-26.6453|-52.7946
5208103|formoso|GO|-13.6499|-48.8775
3126208|formoso|MG|-14.9446|-46.2371
1708205|formoso do araguaia|TO|-11.7976|-49.5316
4308433|forquetinha|RS|-29.3828|-52.0981
2304350|forquilha|CE|-3.79945|-40.2634
4205456|forquilhinha|SC|-28.7454|-49.4785
2304400|fortaleza|CE|-3.71664|-38.5423
3126307|fortaleza de minas|MG|-20.8508|-46.712
1708254|fortaleza do tabocao|TO|-9.05611|-48.5206
2104107|fortaleza dos nogueiras|MA|-6.95983|-46.1749
4308458|fortaleza dos valos|RS|-28.7986|-53.2249
2304459|fortim|CE|-4.45126|-37.7981
2104206|fortuna|MA|-5.72792|-44.1565
3126406|fortuna de minas|MG|-19.5578|-44.4472
4108304|foz do iguacu|PR|-25.5427|-54.5827
4108452|foz do jordao|PR|-25.7371|-52.1188
4205506|fraiburgo|SC|-27.0233|-50.92
3516200|franca|SP|-20.5352|-47.4039
2204006|francinopolis|PI|-6.39334|-42.2591
4108320|francisco alves|PR|-24.0667|-53.8461
2204105|francisco ayres|PI|-6.62606|-42.6881
3126505|francisco badaro|MG|-16.9883|-42.3568
4108403|francisco beltrao|PR|-26.0817|-53.0535
2403905|francisco dantas|RN|-6.07234|-38.1212
3126604|francisco dumont|MG|-17.3107|-44.2317
2204154|francisco macedo|PI|-7.331|-40.788
3516309|francisco morato|SP|-23.2792|-46.7448
3126703|francisco sa|MG|-16.4827|-43.4896
2204204|francisco santos|PI|-6.99491|-41.1288
3126752|franciscopolis|MG|-17.9578|-42.0094
3516408|franco da rocha|SP|-23.3229|-46.729
2304509|frecheirinha|CE|-3.75557|-40.818
4308508|frederico westphalen|RS|-27.3586|-53.3958
3126802|frei gaspar|MG|-18.0709|-41.4325
3126901|frei inocencio|MG|-18.5556|-41.9121
3126950|frei lagonegro|MG|-18.1751|-42.7617
2506202|frei martinho|PB|-6.39759|-36.4526
2605806|frei miguelinho|PE|-7.93918|-35.9113
2802304|frei paulo|SE|-10.5513|-37.5279
4205555|frei rogerio|SC|-27.175|-50.8076
3127008|fronteira|MG|-20.2748|-49.1984
3127057|fronteira dos vales|MG|-16.8898|-40.923
2204303|fronteiras|PI|-7.08173|-40.6146
3127073|fruta de leite|MG|-16.1225|-42.5288
3127107|frutal|MG|-20.0259|-48.9355
2404002|frutuoso gomes|RN|-6.15669|-37.8375
3202207|fundao|ES|-19.937|-40.4078
3127206|funilandia|MG|-19.3661|-44.061
3516507|gabriel monteiro|SP|-21.5294|-50.5573
2506251|gado bravo|PB|-7.58279|-35.7899
3516606|galia|SP|-22.2918|-49.5504
3127305|galileia|MG|-19.0005|-41.5387
2404101|galinhos|RN|-5.0909|-36.2754
4205605|galvao|SC|-26.4549|-52.6875
2605905|gameleira|PE|-8.5798|-35.3846
5208152|gameleira de goias|GO|-16.4854|-48.6454
3127339|gameleiras|MG|-15.0829|-43.125
2911204|gandu|BA|-13.7441|-39.4747
2606002|garanhuns|PE|-8.88243|-36.4966
2802403|gararu|SE|-9.9722|-37.0869
3516705|garca|SP|-22.2125|-49.6546
4308607|garibaldi|RS|-29.259|-51.5352
4205704|garopaba|SC|-28.0275|-48.6192
1503077|garrafao do norte|PA|-1.92986|-47.0505
4308656|garruchos|RS|-28.1944|-55.6383
4205803|garuva|SC|-26.0292|-48.852
4205902|gaspar|SC|-26.9336|-48.9534
3516804|gastao vidigal|SP|-20.7948|-50.1912
5103858|gaucha do norte|MT|-13.2443|-53.0809
4308706|gaurama|RS|-27.5856|-52.0915
2911253|gaviao|BA|-11.4688|-39.7757
3516853|gaviao peixoto|SP|-21.8367|-48.4957
2204352|geminiano|PI|-7.15476|-41.3409
4308805|general camara|RS|-29.9032|-51.7612
5103908|general carneiro|MT|-15.7094|-52.7574
4108502|general carneiro|PR|-26.425|-51.3172
2802502|general maynard|SE|-10.6835|-36.9838
3516903|general salgado|SP|-20.6485|-50.364
2304608|general sampaio|CE|-4.04351|-39.454
4308854|gentil|RS|-28.4316|-52.0337
2911303|gentio do ouro|BA|-11.4342|-42.5077
3517000|getulina|SP|-21.7961|-49.9312
4308904|getulio vargas|RS|-27.8911|-52.2294
2204402|gilbues|PI|-9.83001|-45.3423
2702900|girau do ponciano|AL|-9.88404|-36.8316
4309001|girua|RS|-28.0297|-54.3517
3127354|glaucilandia|MG|-16.8481|-43.692
3517109|glicerio|SP|-21.3812|-50.2123
2911402|gloria|BA|-9.34382|-38.2544
5103957|gloria d oeste|MT|-15.768|-58.3108
5004007|gloria de dourados|MS|-22.4136|-54.2335
2606101|gloria do goita|PE|-8.00568|-35.2904
4309050|glorinha|RS|-29.8798|-50.7734
2104305|godofredo viana|MA|-1.40259|-45.7795
4108551|godoy moreira|PR|-24.173|-51.9246
3127370|goiabeira|MG|-18.9807|-41.2235
3127388|goiana|MG|-21.536|-43.1957
2606200|goiana|PE|-7.5606|-34.9959
5208400|goianapolis|GO|-16.5098|-49.0234
5208509|goiandira|GO|-18.1352|-48.0875
5208608|goianesia|GO|-15.3118|-49.1162
1503093|goianesia do para|PA|-3.84338|-49.0974
5208707|goiania|GO|-16.6864|-49.2643
2404200|goianinha|RN|-6.26486|-35.1943
5208806|goianira|GO|-16.4947|-49.427
1708304|goianorte|TO|-8.77413|-48.9313
5208905|goias|GO|-15.9333|-50.14
1709005|goiatins|TO|-7.71478|-47.3252
5209101|goiatuba|GO|-18.0105|-49.3658
4108601|goioere|PR|-24.1835|-53.0248
4108650|goioxim|PR|-25.1927|-51.9911
3127404|goncalves|MG|-22.6545|-45.8556
2104404|goncalves dias|MA|-5.1475|-44.3013
2911501|gongogi|BA|-14.3195|-39.469
3127503|gonzaga|MG|-18.8196|-42.4769
3127602|gouveia|MG|-18.4519|-43.7423
5209150|gouvelandia|GO|-18.6238|-50.0805
2104503|governador archer|MA|-5.02078|-44.2754
4206009|governador celso ramos|SC|-27.3172|-48.5576
2404309|governador dix sept rosado|RN|-5.44887|-37.5183
2104552|governador edison lobao|MA|-5.74973|-47.3646
2104602|governador eugenio barros|MA|-5.31897|-44.2469
1101005|governador jorge teixeira|RO|-10.61|-62.7371
3202256|governador lindenberg|ES|-19.1864|-40.4473
2104628|governador luiz rocha|MA|-5.47835|-44.0774
2911600|governador mangabeira|BA|-12.5994|-39.0412
2104651|governador newton bello|MA|-3.43245|-45.6619
2104677|governador nunes freire|MA|-2.12899|-45.8777
3127701|governador valadares|MG|-18.8545|-41.9555
2304657|graca|CE|-4.04422|-40.749
2104701|graca aranha|MA|-5.40547|-44.3358
2802601|gracho cardoso|SE|-10.2252|-37.2006
2104800|grajau|MA|-5.81367|-46.1462
4309100|gramado|RS|-29.3734|-50.8762
4309126|gramado dos loureiros|RS|-27.4429|-52.9149
4309159|gramado xavier|RS|-29.2706|-52.5795
4108700|grandes rios|PR|-24.1466|-51.5094
2606309|granito|PE|-7.70711|-39.615
2304707|granja|CE|-3.12788|-40.8372
2304806|granjeiro|CE|-6.88134|-39.2144
3127800|grao mogol|MG|-16.5662|-42.8923
4206108|grao para|SC|-28.1809|-49.2252
2606408|gravata|PE|-8.21118|-35.5675
4309209|gravatai|RS|-29.9413|-50.9869
4206207|gravatal|SC|-28.3208|-49.0427
2304905|groairas|CE|-3.91787|-40.3852
2404408|grossos|RN|-4.98068|-37.1621
3127909|grupiara|MG|-18.5003|-47.7318
4309258|guabiju|RS|-28.5421|-51.6948
4206306|guabiruba|SC|-27.0808|-48.9804
3202306|guacui|ES|-20.7668|-41.6734
2204501|guadalupe|PI|-6.78285|-43.5594
4309308|guaiba|RS|-30.1086|-51.3233
3517208|guaicara|SP|-21.6195|-49.8013
3517307|guaimbe|SP|-21.9091|-49.8986
3517406|guaira|SP|-20.3196|-48.312
4108809|guaira|PR|-24.085|-54.2573
4108908|guairaca|PR|-22.932|-52.6906
2304954|guaiuba|CE|-4.04057|-38.6404
1301654|guajara|AM|-7.53797|-72.5907
1100106|guajara mirim|RO|-10.7889|-65.3296
2911659|guajeru|BA|-14.5467|-41.9381
2404507|guamare|RN|-5.10619|-36.3222
4108957|guamiranga|PR|-25.1912|-50.8021
2911709|guanambi|BA|-14.2231|-42.7799
3128006|guanhaes|MG|-18.7713|-42.9312
3128105|guape|MG|-20.7631|-45.9152
3517505|guapiacu|SP|-20.7959|-49.2172
3517604|guapiara|SP|-24.1892|-48.5295
3301850|guapimirim|RJ|-22.5347|-42.9895
4109005|guapirama|PR|-23.5203|-50.0407
5209200|guapo|GO|-16.8297|-49.5345
4309407|guapore|RS|-28.8399|-51.8895
4109104|guaporema|PR|-23.3402|-52.7786
3517703|guara|SP|-20.4302|-47.8236
2506301|guarabira|PB|-6.85064|-35.485
3517802|guaracai|SP|-21.0292|-51.2119
3517901|guaraci|SP|-20.4977|-48.9391
4109203|guaraci|PR|-22.9694|-51.6504
3128204|guaraciaba|MG|-20.5716|-43.0094
4206405|guaraciaba|SC|-26.6042|-53.5243
2305001|guaraciaba do norte|CE|-4.15814|-40.7476
3128253|guaraciama|MG|-17.0142|-43.6675
1709302|guarai|TO|-8.83543|-48.5114
5209291|guaraita|GO|-15.6121|-50.0265
2305100|guaramiranga|CE|-4.26248|-38.932
4206504|guaramirim|SC|-26.4688|-49.0026
3128303|guaranesia|MG|-21.3009|-46.7964
3128402|guarani|MG|-21.3563|-43.0328
3518008|guarani d oeste|SP|-20.0746|-50.3411
4309506|guarani das missoes|RS|-28.1491|-54.5629
5209408|guarani de goias|GO|-13.9421|-46.4868
4109302|guaraniacu|PR|-25.0968|-52.8755
3518107|guaranta|SP|-21.8942|-49.5914
5104104|guaranta do norte|MT|-9.96218|-54.9121
3202405|guarapari|ES|-20.6772|-40.5093
4109401|guarapuava|PR|-25.3902|-51.4623
4109500|guaraquecaba|PR|-25.3071|-48.3204
3128501|guarara|MG|-21.7304|-43.0334
3518206|guararapes|SP|-21.2544|-50.6453
3518305|guararema|SP|-23.4112|-46.0369
2911808|guaratinga|BA|-16.5833|-39.7847
3518404|guaratingueta|SP|-22.8075|-45.1938
4109609|guaratuba|PR|-25.8817|-48.5752
3128600|guarda mor|MG|-17.7673|-47.0998
3518503|guarei|SP|-23.3714|-48.1837
3518602|guariba|SP|-21.3594|-48.2316
2204550|guaribas|PI|-9.38647|-43.6943
5209457|guarinos|GO|-14.7292|-49.7006
3518701|guaruja|SP|-23.9888|-46.258
4206603|guaruja do sul|SC|-26.3858|-53.5296
3518800|guarulhos|SP|-23.4538|-46.5333
4206652|guatambu|SC|-27.1341|-52.7887
3518859|guatapara|SP|-21.4944|-48.0356
3128709|guaxupe|MG|-21.305|-46.7081
5004106|guia lopes da laguna|MS|-21.4583|-56.1117
3128808|guidoval|MG|-21.155|-42.7887
2104909|guimaraes|MA|-2.12755|-44.602
3128907|guimarania|MG|-18.8425|-46.7901
5104203|guiratinga|MT|-16.346|-53.7575
3129004|guiricema|MG|-21.0098|-42.7207
3129103|gurinhata|MG|-19.2143|-49.7876
2506400|gurinhem|PB|-7.1233|-35.4222
2506509|gurjao|PB|-7.24833|-36.4923
1503101|gurupa|PA|-1.41412|-51.6338
1709500|gurupi|TO|-11.7279|-49.068
3518909|guzolandia|SP|-20.6467|-50.6645
4309555|harmonia|RS|-29.5456|-51.4185
5209606|heitorai|GO|-15.719|-49.8268
3129202|heliodora|MG|-22.0644|-45.5453
2911857|heliopolis|BA|-10.6825|-38.2907
3519006|herculandia|SP|-22.0038|-50.3907
4307104|herval|RS|-32.024|-53.3944
4206702|herval d oeste|SC|-27.1903|-51.4917
4309571|herveiras|RS|-29.4552|-52.6553
5209705|hidrolandia|GO|-16.9626|-49.2265
2305209|hidrolandia|CE|-4.40958|-40.4056
5209804|hidrolina|GO|-14.7261|-49.4634
3519055|holambra|SP|-22.6405|-47.0487
4109658|honorio serpa|PR|-26.139|-52.3848
2305233|horizonte|CE|-4.1209|-38.4707
4309605|horizontina|RS|-27.6282|-54.3053
3519071|hortolandia|SP|-22.8529|-47.2143
2204600|hugo napoleao|PI|-5.9886|-42.5598
4309654|hulha negra|RS|-31.4067|-53.8667
4309704|humaita|RS|-27.5691|-53.9695
1301704|humaita|AM|-7.51171|-63.0327
2105005|humberto de campos|MA|-2.59828|-43.4649
3519105|iacanga|SP|-21.8896|-49.031
5209903|iaciara|GO|-14.1011|-46.6335
3519204|iacri|SP|-21.8572|-50.6932
2911907|iacu|BA|-12.7666|-40.2056
3129301|iapu|MG|-19.4387|-42.2147
3519253|iaras|SP|-22.8682|-49.1634
2606507|iati|PE|-9.04559|-36.8498
4109708|ibaiti|PR|-23.8478|-50.1932
4309753|ibarama|RS|-29.4203|-53.1295
2305266|ibaretama|CE|-4.80376|-38.7501
3519303|ibate|SP|-21.9584|-47.9882
2703007|ibateguara|AL|-8.97823|-35.9373
3202454|ibatiba|ES|-20.2347|-41.5087
4109757|ibema|PR|-25.1193|-53.0072
3129400|ibertioga|MG|-21.433|-43.9639
3129509|ibia|MG|-19.4749|-46.5474
4309803|ibiaca|RS|-28.0566|-51.8599
3129608|ibiai|MG|-16.8591|-44.9046
4206751|ibiam|SC|-27.1847|-51.2352
2305308|ibiapina|CE|-3.92403|-40.8911
2506608|ibiara|PB|-7.47957|-38.4059
2912004|ibiassuce|BA|-14.2711|-42.257
2912103|ibicarai|BA|-14.8579|-39.5914
4206801|ibicare|SC|-27.0881|-51.3681
2912202|ibicoara|BA|-13.4059|-41.284
2912301|ibicui|BA|-14.845|-39.9879
2305332|ibicuitinga|CE|-4.96999|-38.6362
2606606|ibimirim|PE|-8.54026|-37.7032
2912400|ibipeba|BA|-11.6438|-42.0195
2912509|ibipitanga|BA|-12.8804|-42.4856
4109807|ibipora|PR|-23.2659|-51.0522
2912608|ibiquera|BA|-12.6444|-40.9338
3519402|ibira|SP|-21.083|-49.2448
3129657|ibiracatu|MG|-15.6605|-44.1667
3129707|ibiraci|MG|-20.4611|-47.1222
3202504|ibiracu|ES|-19.8366|-40.3732
4309902|ibiraiaras|RS|-28.3741|-51.6377
2606705|ibirajuba|PE|-8.57633|-36.1812
4206900|ibirama|SC|-27.0547|-49.5193
2912707|ibirapitanga|BA|-14.1649|-39.3787
2912806|ibirapua|BA|-17.6832|-40.1129
4309951|ibirapuita|RS|-28.6247|-52.5158
3519501|ibirarema|SP|-22.8185|-50.0739
2912905|ibirataia|BA|-14.0643|-39.6459
3129806|ibirite|MG|-20.0252|-44.0569
4310009|ibiruba|RS|-28.6302|-53.0961
2913002|ibitiara|BA|-12.6502|-42.2179
3519600|ibitinga|SP|-21.7562|-48.8319
3202553|ibitirama|ES|-20.5466|-41.6667
2913101|ibitita|BA|-11.5414|-41.9748
3129905|ibitiura de minas|MG|-22.0604|-46.4368
3130002|ibituruna|MG|-21.1541|-44.7479
3519709|ibiuna|SP|-23.6596|-47.223
2913200|ibotirama|BA|-12.1779|-43.2167
2305357|icapui|CE|-4.71206|-37.3531
4207007|icara|SC|-28.7132|-49.3087
3130051|icarai de minas|MG|-16.214|-44.9034
4109906|icaraima|PR|-23.3944|-53.615
2105104|icatu|MA|-2.77206|-44.0501
3519808|icem|SP|-20.3391|-49.1915
2913309|ichu|BA|-11.7431|-39.1905
2305407|ico|CE|-6.39627|-38.8554
3202603|iconha|ES|-20.7913|-40.8132
2404606|ielmo marinho|RN|-5.82447|-35.55
3519907|iepe|SP|-22.6602|-51.0779
2703106|igaci|AL|-9.53768|-36.6372
2913408|igapora|BA|-13.774|-42.7155
3520004|igaracu do tiete|SP|-22.509|-48.5597
2502607|igaracy|PB|-7.17184|-38.1478
3520103|igarapava|SP|-20.0407|-47.7466
3130101|igarape|MG|-20.0707|-44.2994
2105153|igarape do meio|MA|-3.65771|-45.2114
2105203|igarape grande|MA|-4.6625|-44.8558
1503200|igarape acu|PA|-1.12539|-47.626
1503309|igarape miri|PA|-1.97533|-48.9575
2606804|igarassu|PE|-7.82881|-34.9013
3520202|igarata|SP|-23.2037|-46.157
3130200|igaratinga|MG|-19.9476|-44.7063
2913457|igrapiuna|BA|-13.8295|-39.1361
2703205|igreja nova|AL|-10.1235|-36.6597
4310108|igrejinha|RS|-29.5693|-50.7919
3301876|iguaba grande|RJ|-22.8495|-42.2299
2913507|iguai|BA|-14.7528|-40.0894
3520301|iguape|SP|-24.699|-47.5537
4110003|iguaracu|PR|-23.1949|-51.8256
2606903|iguaracy|PE|-7.83222|-37.5082
3130309|iguatama|MG|-20.1776|-45.7111
5004304|iguatemi|MS|-23.6736|-54.5637
2305506|iguatu|CE|-6.36281|-39.2892
4110052|iguatu|PR|-24.7153|-53.0827
3130408|ijaci|MG|-21.1738|-44.9233
4310207|ijui|RS|-28.388|-53.92
3520426|ilha comprida|SP|-24.7307|-47.5383
2802700|ilha das flores|SE|-10.4425|-36.5479
2607604|ilha de itamaraca|PE|-7.74766|-34.8303
2204659|ilha grande|PI|-2.85774|-41.8186
3520442|ilha solteira|SP|-20.4326|-51.3426
3520400|ilhabela|SP|-23.7785|-45.3552
2913606|ilheus|BA|-14.793|-39.046
4207106|ilhota|SC|-26.9023|-48.8251
3130507|ilicinea|MG|-20.9402|-45.8308
4310306|ilopolis|RS|-28.9282|-52.1258
2506707|imaculada|PB|-7.3889|-37.5079
4207205|imarui|SC|-28.3339|-48.817
4110078|imbau|PR|-24.448|-50.7533
4310330|imbe|RS|-29.9753|-50.1281
3130556|imbe de minas|MG|-19.6017|-41.9695
4207304|imbituba|SC|-28.2284|-48.6659
4110102|imbituva|PR|-25.2285|-50.5989
4207403|imbuia|SC|-27.4908|-49.4218
4310363|imigrante|RS|-29.3508|-51.7748
2105302|imperatriz|MA|-5.51847|-47.4777
4110201|inacio martins|PR|-25.5704|-51.0769
5209937|inaciolandia|GO|-18.4869|-49.9888
2607000|inaja|PE|-8.90206|-37.8351
4110300|inaja|PR|-22.7509|-52.1995
3130606|inconfidentes|MG|-22.3136|-46.3264
3130655|indaiabira|MG|-15.4911|-42.2005
4207502|indaial|SC|-26.8992|-49.2354
3520509|indaiatuba|SP|-23.0816|-47.2101
4310405|independencia|RS|-27.8354|-54.1886
2305605|independencia|CE|-5.38789|-40.3085
3520608|indiana|SP|-22.1738|-51.2555
4110409|indianopolis|PR|-23.4762|-52.6989
3130705|indianopolis|MG|-19.0341|-47.9155
3520707|indiapora|SP|-19.979|-50.2909
5209952|indiara|GO|-17.1387|-49.9862
2802809|indiaroba|SE|-11.5157|-37.515
5104500|indiavai|MT|-15.4921|-58.5802
2506806|inga|PB|-7.28144|-35.605
3130804|ingai|MG|-21.4024|-44.9152
2607109|ingazeira|PE|-7.66909|-37.4576
4310413|inhacora|RS|-27.8752|-54.015
2913705|inhambupe|BA|-11.781|-38.355
1503408|inhangapi|PA|-1.4349|-47.9114
2703304|inhapi|AL|-9.22594|-37.7509
3130903|inhapim|MG|-19.5476|-42.1147
3131000|inhauma|MG|-19.4898|-44.3934
2204709|inhuma|PI|-6.665|-41.7041
5210000|inhumas|GO|-16.3611|-49.5001
3131109|inimutaba|MG|-18.7271|-44.3584
5004403|inocencia|MS|-19.7277|-51.9281
3520806|inubia paulista|SP|-21.7695|-50.9633
4207577|iomere|SC|-27.0019|-51.2442
3131158|ipaba|MG|-19.4158|-42.4139
5210109|ipameri|GO|-17.7215|-48.1581
3131208|ipanema|MG|-19.7992|-41.7164
2404705|ipanguacu|RN|-5.48984|-36.8501
2305654|ipaporanga|CE|-4.89764|-40.7537
3131307|ipatinga|MG|-19.4703|-42.5476
2305704|ipaumirim|CE|-6.78265|-38.7179
3520905|ipaussu|SP|-23.0575|-49.6279
4310439|ipe|RS|-28.8171|-51.2859
2913804|ipecaeta|BA|-12.3028|-39.3069
3521002|ipero|SP|-23.3513|-47.6927
3521101|ipeuna|SP|-22.4355|-47.7151
3131406|ipiacu|MG|-18.6927|-49.9436
2913903|ipiau|BA|-14.1226|-39.7353
3521150|ipigua|SP|-20.6557|-49.3842
2914000|ipira|BA|-12.1561|-39.7359
4207601|ipira|SC|-27.4038|-51.7758
4110508|ipiranga|PR|-25.0238|-50.5794
5210158|ipiranga de goias|GO|-15.1689|-49.6695
5104526|ipiranga do norte|MT|-12.2408|-56.1531
2204808|ipiranga do piaui|PI|-6.82421|-41.7381
4310462|ipiranga do sul|RS|-27.9404|-52.4271
1301803|ipixuna|AM|-7.04791|-71.6934
1503457|ipixuna do para|PA|-2.55992|-47.5059
2607208|ipojuca|PE|-8.39303|-35.0609
4110607|ipora|PR|-24.0083|-53.706
5210208|ipora|GO|-16.4398|-51.118
4207650|ipora do oeste|SC|-26.9854|-53.5355
3521200|iporanga|SP|-24.5847|-48.5971
2305803|ipu|CE|-4.31748|-40.7059
3521309|ipua|SP|-20.4438|-48.0129
4207684|ipuacu|SC|-26.635|-52.4556
2607307|ipubi|PE|-7.64505|-40.1476
2404804|ipueira|RN|-6.80596|-37.2045
1709807|ipueiras|TO|-11.2329|-48.46
2305902|ipueiras|CE|-4.53802|-40.7118
3131505|ipuiuna|MG|-22.1013|-46.1915
4207700|ipumirim|SC|-27.0772|-52.1289
2914109|ipupiara|BA|-11.8219|-42.6179
1400282|iracema|RR|2.18305|-61.0415
2306009|iracema|CE|-5.8124|-38.2919
4110656|iracema do oeste|PR|-24.4262|-53.3528
3521408|iracemapolis|SP|-22.5832|-47.523
4207759|iraceminha|SC|-26.8215|-53.2767
4310504|irai|RS|-27.1951|-53.2543
3131604|irai de minas|MG|-18.9819|-47.461
2914208|irajuba|BA|-13.2563|-40.0848
2914307|iramaia|BA|-13.2902|-40.9595
1301852|iranduba|AM|-3.27479|-60.19
4207809|irani|SC|-27.0287|-51.9012
3521507|irapua|SP|-21.2768|-49.4164
3521606|irapuru|SP|-21.5684|-51.3472
2914406|iraquara|BA|-12.2429|-41.6155
2914505|irara|BA|-12.0504|-38.7631
4110706|irati|PR|-25.4697|-50.6493
4207858|irati|SC|-26.6539|-52.8955
2306108|iraucuba|CE|-3.74737|-39.7843
2914604|irece|BA|-11.3033|-41.8535
4110805|iretama|PR|-24.4253|-52.1012
4207908|irineopolis|SC|-26.242|-50.7957
1503507|irituia|PA|-1.76984|-47.446
3202652|irupi|ES|-20.3501|-41.6444
2204907|isaias coelho|PI|-7.73597|-41.6735
5210307|israelandia|GO|-16.3144|-50.9087
4208005|ita|SC|-27.2907|-52.3212
4310538|itaara|RS|-29.6013|-53.7725
2506905|itabaiana|PB|-7.33167|-35.3317
2802908|itabaiana|SE|-10.6826|-37.4273
2803005|itabaianinha|SE|-11.2693|-37.7875
2914653|itabela|BA|-16.5732|-39.5593
3521705|itabera|SP|-23.8638|-49.14
2914703|itaberaba|BA|-12.5242|-40.3059
5210406|itaberai|GO|-16.0206|-49.806
2803104|itabi|SE|-10.1248|-37.1056
3131703|itabira|MG|-19.6239|-43.2312
3131802|itabirinha|MG|-18.5712|-41.234
3131901|itabirito|MG|-20.2501|-43.8038
3301900|itaborai|RJ|-22.7565|-42.8639
2914802|itabuna|BA|-14.7876|-39.2781
1710508|itacaja|TO|-8.39293|-47.7726
3132008|itacambira|MG|-17.0625|-43.3069
3132107|itacarambi|MG|-15.089|-44.095
2914901|itacare|BA|-14.2784|-38.9959
1301902|itacoatiara|AM|-3.13861|-58.4449
2607406|itacuruba|PE|-8.82231|-38.6975
4310553|itacurubi|RS|-28.7913|-55.2447
2915007|itaete|BA|-12.9831|-40.9677
2915106|itagi|BA|-14.1615|-40.0131
2915205|itagiba|BA|-14.2782|-39.8449
2915304|itagimirim|BA|-16.0819|-39.6133
3202702|itaguacu|ES|-19.8018|-40.8601
2915353|itaguacu da bahia|BA|-11.0147|-42.3997
3302007|itaguai|RJ|-22.8636|-43.7798
4110904|itaguaje|PR|-22.6183|-51.9674
3132206|itaguara|MG|-20.3947|-44.4875
5210562|itaguari|GO|-15.918|-49.6071
5210604|itaguaru|GO|-15.7565|-49.6354
1710706|itaguatins|TO|-5.77267|-47.4864
3521804|itai|SP|-23.4213|-49.092
2607505|itaiba|PE|-8.94569|-37.4173
2306207|itaicaba|CE|-4.67146|-37.833
2205003|itainopolis|PI|-7.44336|-41.4687
4208104|itaiopolis|SC|-26.339|-49.9092
2105351|itaipava do grajau|MA|-5.14252|-45.7877
3132305|itaipe|MG|-17.4014|-41.6697
4110953|itaipulandia|PR|-25.1366|-54.3001
2306256|itaitinga|CE|-3.96577|-38.5298
1503606|itaituba|PA|-4.2667|-55.9926
2404853|itaja|RN|-5.63894|-36.8712
5210802|itaja|GO|-19.0673|-51.5495
4208203|itajai|SC|-26.9101|-48.6705
3521903|itajobi|SP|-21.3123|-49.0629
3522000|itaju|SP|-21.9857|-48.8116
2915403|itaju do colonia|BA|-15.1366|-39.7283
3132404|itajuba|MG|-22.4225|-45.4598
2915502|itajuipe|BA|-14.6788|-39.3698
3302056|italva|RJ|-21.4296|-41.7014
2915601|itamaraju|BA|-17.0378|-39.5386
3132503|itamarandiba|MG|-17.8552|-42.8561
1301951|itamarati|AM|-6.43852|-68.2437
3132602|itamarati de minas|MG|-21.4179|-42.813
2915700|itamari|BA|-13.7782|-39.683
3132701|itambacuri|MG|-18.035|-41.683
4111001|itambaraca|PR|-23.0181|-50.4097
4111100|itambe|PR|-23.6601|-51.9912
2607653|itambe|PE|-7.41403|-35.0963
2915809|itambe|BA|-15.2429|-40.63
3132800|itambe do mato dentro|MG|-19.4158|-43.3182
3132909|itamogi|MG|-21.0758|-47.046
3133006|itamonte|MG|-22.2859|-44.868
2915908|itanagra|BA|-12.2614|-38.0436
3522109|itanhaem|SP|-24.1736|-46.788
3133105|itanhandu|MG|-22.2942|-44.9382
5104542|itanhanga|MT|-12.2259|-56.6463
2916005|itanhem|BA|-17.1642|-40.3321
3133204|itanhomi|MG|-19.1736|-41.863
3133303|itaobim|MG|-16.5571|-41.5017
3522158|itaoca|SP|-24.6393|-48.8413
3302106|itaocara|RJ|-21.6748|-42.0758
5210901|itapaci|GO|-14.9522|-49.5511
3133402|itapagipe|MG|-19.9062|-49.3781
2306306|itapaje|CE|-3.68314|-39.5855
2916104|itaparica|BA|-12.8932|-38.68
2916203|itape|BA|-14.8876|-39.4239
2916302|itapebi|BA|-15.9551|-39.5329
3133501|itapecerica|MG|-20.4704|-45.127
3522208|itapecerica da serra|SP|-23.7161|-46.8572
2105401|itapecuru mirim|MA|-3.40202|-44.3508
4111209|itapejara d oeste|PR|-25.9619|-52.8152
4208302|itapema|SC|-27.0861|-48.616
3202801|itapemirim|ES|-21.0095|-40.8307
4111258|itaperucu|PR|-25.2193|-49.3454
3302205|itaperuna|RJ|-21.1997|-41.8799
2607703|itapetim|PE|-7.37178|-37.1863
2916401|itapetinga|BA|-15.2475|-40.2482
3522307|itapetininga|SP|-23.5886|-48.0483
3522406|itapeva|SP|-23.9788|-48.8764
3133600|itapeva|MG|-22.7665|-46.2241
3522505|itapevi|SP|-23.5488|-46.9327
2916500|itapicuru|BA|-11.3088|-38.2262
2306405|itapipoca|CE|-3.49933|-39.5836
3522604|itapira|SP|-22.4357|-46.8224
1302009|itapiranga|AM|-2.74081|-58.0293
4208401|itapiranga|SC|-27.1659|-53.7166
5211008|itapirapua|GO|-15.8205|-50.6094
3522653|itapirapua paulista|SP|-24.572|-49.1661
1710904|itapiratins|TO|-8.37982|-48.1072
2607752|itapissuma|PE|-7.76798|-34.8971
2916609|itapitanga|BA|-14.4139|-39.5657
2306504|itapiuna|CE|-4.55516|-38.9281
4208450|itapoa|SC|-26.1158|-48.6182
3522703|itapolis|SP|-21.5942|-48.8149
5004502|itapora|MS|-22.08|-54.7934
1711100|itapora do tocantins|TO|-8.57172|-48.6895
3522802|itaporanga|SP|-23.7043|-49.4819
2507002|itaporanga|PB|-7.30202|-38.1504
2803203|itaporanga d ajuda|SE|-10.99|-37.3078
2507101|itapororoca|PB|-6.82374|-35.2406
1101104|itapua do oeste|RO|-9.19687|-63.1809
4310579|itapuca|RS|-28.7768|-52.1693
3522901|itapui|SP|-22.2324|-48.7197
3523008|itapura|SP|-20.6419|-51.5063
5211206|itapuranga|GO|-15.5606|-49.949
3523107|itaquaquecetuba|SP|-23.4835|-46.3457
2916708|itaquara|BA|-13.4459|-39.9378
4310603|itaqui|RS|-29.1311|-56.5515
5004601|itaquirai|MS|-23.4779|-54.187
2607802|itaquitinga|PE|-7.66373|-35.1002
3202900|itarana|ES|-19.875|-40.8753
2916807|itarantim|BA|-15.6528|-40.065
3523206|itarare|SP|-24.1085|-49.3352
2306553|itarema|CE|-2.9248|-39.9167
3523305|itariri|SP|-24.2834|-47.1736
5211305|itaruma|GO|-18.7646|-51.3485
4310652|itati|RS|-29.4974|-50.1016
3302254|itatiaia|RJ|-22.4897|-44.5675
3133709|itatiaiucu|MG|-20.1983|-44.4211
3523404|itatiba|SP|-23.0035|-46.8464
4310702|itatiba do sul|RS|-27.3846|-52.4538
2916856|itatim|BA|-12.7099|-39.6952
3523503|itatinga|SP|-23.1047|-48.6157
2306603|itatira|CE|-4.52608|-39.6202
2507200|itatuba|PB|-7.38115|-35.638
2404903|itau|RN|-5.8363|-37.9912
3133758|itau de minas|MG|-20.7375|-46.7525
5104559|itauba|MT|-11.0614|-55.2766
1600253|itaubal|AP|0.602185|-50.6996
5211404|itaucu|GO|-16.2029|-49.6109
2205102|itaueira|PI|-7.59989|-43.0249
3133808|itauna|MG|-20.0818|-44.5801
4111308|itauna do sul|PR|-22.7289|-52.8874
3133907|itaverava|MG|-20.6769|-43.6141
3134004|itinga|MG|-16.61|-41.7672
2105427|itinga do maranhao|MA|-4.45293|-47.5235
5104609|itiquira|MT|-17.2147|-54.1422
3523602|itirapina|SP|-22.2562|-47.8166
3523701|itirapua|SP|-20.6416|-47.2194
2916906|itirucu|BA|-13.529|-40.1472
2917003|itiuba|BA|-10.6948|-39.8446
3523800|itobi|SP|-21.7309|-46.9743
2917102|itororo|BA|-15.11|-40.0684
3523909|itu|SP|-23.2544|-47.2927
2917201|ituacu|BA|-13.8107|-41.3003
2917300|itubera|BA|-13.7249|-39.1481
3134103|itueta|MG|-19.3999|-41.1746
3134202|ituiutaba|MG|-18.9772|-49.4639
5211503|itumbiara|GO|-18.4093|-49.2158
3134301|itumirim|MG|-21.3171|-44.8724
3524006|itupeva|SP|-23.1526|-47.0593
1503705|itupiranga|PA|-5.13272|-49.3358
4208500|ituporanga|SC|-27.4101|-49.5963
3134400|iturama|MG|-19.7276|-50.1966
3134509|itutinga|MG|-21.3|-44.6567
3524105|ituverava|SP|-20.3355|-47.7902
2917334|iuiu|BA|-14.4054|-43.5595
3203007|iuna|ES|-20.3531|-41.5334
4111407|ivai|PR|-25.0067|-50.857
4111506|ivaipora|PR|-24.2485|-51.6754
4111555|ivate|PR|-23.4072|-53.3687
4111605|ivatuba|PR|-23.6187|-52.2203
5004700|ivinhema|MS|-22.3046|-53.8184
5211602|ivolandia|GO|-16.5995|-50.7921
4310751|ivora|RS|-29.5232|-53.5842
4310801|ivoti|RS|-29.5995|-51.1533
2607901|jaboatao dos guararapes|PE|-8.11298|-35.015
4208609|jabora|SC|-27.1782|-51.7279
2917359|jaborandi|BA|-13.6071|-44.4255
3524204|jaborandi|SP|-20.6884|-48.4112
4111704|jaboti|PR|-23.7435|-50.0729
4310850|jaboticaba|RS|-27.6347|-53.2762
3524303|jaboticabal|SP|-21.252|-48.3252
3134608|jaboticatubas|MG|-19.5119|-43.7373
2405009|jacana|RN|-6.41856|-36.2031
2917409|jacaraci|BA|-14.8541|-42.4329
2507309|jacarau|PB|-6.61453|-35.289
2703403|jacare dos homens|AL|-9.63545|-37.2076
1503754|jacareacanga|PA|-6.21469|-57.7544
3524402|jacarei|SP|-23.2983|-45.9658
4111803|jacarezinho|PR|-23.1591|-49.9739
3524501|jaci|SP|-20.8805|-49.5797
5104807|jaciara|MT|-15.9548|-54.9733
3134707|jacinto|MG|-16.1428|-40.295
4208708|jacinto machado|SC|-28.9961|-49.7623
2917508|jacobina|BA|-11.1812|-40.5117
2205151|jacobina do piaui|PI|-7.93063|-41.2075
3134806|jacui|MG|-21.0137|-46.7359
2703502|jacuipe|AL|-8.83951|-35.4591
4310876|jacuizinho|RS|-29.0401|-53.0657
1503804|jacunda|PA|-4.44617|-49.1153
3524600|jacupiranga|SP|-24.6963|-48.0064
4310900|jacutinga|RS|-27.7291|-52.5372
3134905|jacutinga|MG|-22.286|-46.6166
4111902|jaguapita|PR|-23.1104|-51.5342
2917607|jaguaquara|BA|-13.5248|-39.964
3135001|jaguaracu|MG|-19.647|-42.7498
4311007|jaguarao|RS|-32.5604|-53.377
2917706|jaguarari|BA|-10.2569|-40.1999
3203056|jaguare|ES|-18.907|-40.0759
2306702|jaguaretama|CE|-5.6051|-38.7639
4311106|jaguari|RS|-29.4936|-54.703
4112009|jaguariaiva|PR|-24.2439|-49.7066
2306801|jaguaribara|CE|-5.67765|-38.5359
2306900|jaguaribe|CE|-5.90213|-38.6227
2917805|jaguaripe|BA|-13.1109|-38.8939
3524709|jaguariuna|SP|-22.7037|-46.9851
2307007|jaguaruana|CE|-4.83151|-37.781
4208807|jaguaruna|SC|-28.6146|-49.0296
3135050|jaiba|MG|-15.3432|-43.6688
2205201|jaicos|PI|-7.36229|-41.1371
3524808|jales|SP|-20.2672|-50.5494
3524907|jambeiro|SP|-23.2522|-45.6942
3135076|jampruca|MG|-18.461|-41.809
3135100|janauba|MG|-15.8022|-43.3132
5211701|jandaia|GO|-17.0481|-50.1453
4112108|jandaia do sul|PR|-23.6011|-51.6448
2405108|jandaira|RN|-5.35211|-36.1278
2917904|jandaira|BA|-11.5616|-37.7853
3525003|jandira|SP|-23.5275|-46.9023
2405207|janduis|RN|-6.01474|-37.4048
5104906|jangada|MT|-15.235|-56.4917
4112207|janiopolis|PR|-24.1401|-52.7784
3135209|januaria|MG|-15.4802|-44.3639
2405306|januario cicco boa saude|RN|-6.16566|-35.6219
3135308|japaraiba|MG|-20.1442|-45.5015
2703601|japaratinga|AL|-9.08746|-35.2634
2803302|japaratuba|SE|-10.5849|-36.9418
3302270|japeri|RJ|-22.6435|-43.6602
2405405|japi|RN|-6.46544|-35.9346
4112306|japira|PR|-23.8142|-50.1422
2803401|japoata|SE|-10.3477|-36.8045
3135357|japonvar|MG|-15.9891|-44.2758
5004809|japora|MS|-23.8903|-54.4059
4112405|japura|PR|-23.4693|-52.5557
1302108|japura|AM|-1.88237|-66.9291
2607950|jaqueira|PE|-8.72618|-35.7942
4311122|jaquirana|RS|-28.8811|-50.3637
5211800|jaragua|GO|-15.7529|-49.3344
4208906|jaragua do sul|SC|-26.4851|-49.0713
5004908|jaraguari|MS|-20.1386|-54.3996
2703700|jaramataia|AL|-9.66224|-37.0046
2307106|jardim|CE|-7.57599|-39.2826
5005004|jardim|MS|-21.4799|-56.1489
4112504|jardim alegre|PR|-24.1809|-51.6902
2405504|jardim de angicos|RN|-5.64999|-35.9713
2405603|jardim de piranhas|RN|-6.37665|-37.3496
2205250|jardim do mulato|PI|-6.099|-42.63
2405702|jardim do serido|RN|-6.58047|-36.7736
4112603|jardim olinda|PR|-22.5523|-52.0503
3525102|jardinopolis|SP|-21.0176|-47.7606
4208955|jardinopolis|SC|-26.7191|-52.8625
4311130|jari|RS|-29.2922|-54.2237
3525201|jarinu|SP|-23.1039|-46.728
1100114|jaru|RO|-10.4318|-62.4788
5211909|jatai|GO|-17.8784|-51.7204
4112702|jataizinho|PR|-23.2578|-50.9777
2608008|jatauba|PE|-7.97668|-36.4943
5005103|jatei|MS|-22.4806|-54.3079
2307205|jati|CE|-7.6797|-39.0029
2105450|jatoba|MA|-5.82282|-44.2153
2608057|jatoba|PE|-9.17476|-38.2607
2205276|jatoba do piaui|PI|-4.77025|-41.817
3525300|jau|SP|-22.2936|-48.5592
1711506|jau do tocantins|TO|-12.6509|-48.589
5212006|jaupaci|GO|-16.1773|-50.9508
5105002|jauru|MT|-15.3342|-58.8723
3135407|jeceaba|MG|-20.5339|-43.9894
3135456|jenipapo de minas|MG|-17.0831|-42.2589
2105476|jenipapo dos vieiras|MA|-5.36237|-45.6356
3135506|jequeri|MG|-20.4542|-42.6651
2703759|jequia da praia|AL|-10.0133|-36.0142
2918001|jequie|BA|-13.8509|-40.0877
3135605|jequitai|MG|-17.229|-44.4376
3135704|jequitiba|MG|-19.2345|-44.0304
3135803|jequitinhonha|MG|-16.4375|-41.0117
2918100|jeremoabo|BA|-10.0685|-38.3471
2507408|jerico|PB|-6.54577|-37.8036
3525409|jeriquara|SP|-20.3116|-47.5918
3203106|jeronimo monteiro|ES|-20.7994|-41.3948
2205300|jerumenha|PI|-7.09128|-43.5033
3135902|jesuania|MG|-21.9887|-45.2911
4112751|jesuitas|PR|-24.3839|-53.3849
5212055|jesupolis|GO|-15.9484|-49.3739
1100122|ji parana|RO|-10.8777|-61.9322
2307254|jijoca de jericoacoara|CE|-2.79331|-40.5127
2918209|jiquirica|BA|-13.2621|-39.5737
2918308|jitauna|BA|-14.0131|-39.8969
4209003|joacaba|SC|-27.1721|-51.5108
3136009|joaima|MG|-16.6522|-41.0229
3136108|joanesia|MG|-19.1729|-42.6775
3525508|joanopolis|SP|-22.927|-46.2741
2608107|joao alfredo|PE|-7.86565|-35.5787
2405801|joao camara|RN|-5.54094|-35.8122
2205359|joao costa|PI|-8.50736|-42.4264
2405900|joao dias|RN|-6.27215|-37.7885
2918357|joao dourado|BA|-11.3486|-41.6548
2105500|joao lisboa|MA|-5.44363|-47.4064
3136207|joao monlevade|MG|-19.8126|-43.1735
3203130|joao neiva|ES|-19.7577|-40.386
2507507|joao pessoa|PB|-7.11509|-34.8641
3136306|joao pinheiro|MG|-17.7398|-46.1715
3525607|joao ramalho|SP|-22.2473|-50.7694
3136405|joaquim felicio|MG|-17.758|-44.1643
2703809|joaquim gomes|AL|-9.1328|-35.7474
2608206|joaquim nabuco|PE|-8.62281|-35.5288
2205409|joaquim pires|PI|-3.50164|-42.1865
4112801|joaquim tavora|PR|-23.4987|-49.909
2513653|joca claudino|PB|-6.48362|-38.4764
2205458|joca marques|PI|-3.4804|-42.4255
4311155|joia|RS|-28.6435|-54.1141
4209102|joinville|SC|-26.3045|-48.8487
3136504|jordania|MG|-15.9009|-40.1841
1200328|jordao|AC|-9.1908|-71.9503
4209151|jose boiteux|SC|-26.9566|-49.6286
3525706|jose bonifacio|SP|-21.0551|-49.6892
2406007|jose da penha|RN|-6.31095|-38.2823
2205508|jose de freitas|PI|-4.75146|-42.5746
3136520|jose goncalves de minas|MG|-16.9053|-42.6014
3136553|jose raydan|MG|-18.2195|-42.4946
2105609|joselandia|MA|-4.98611|-44.6958
3136579|josenopolis|MG|-16.5417|-42.5151
5212105|joviania|GO|-17.802|-49.6197
5105101|juara|MT|-11.2639|-57.5244
2507606|juarez tavora|PB|-7.1713|-35.5686
1711803|juarina|TO|-8.11951|-49.0643
3136652|juatuba|MG|-19.9448|-44.3451
2507705|juazeirinho|PB|-7.06092|-36.5793
2918407|juazeiro|BA|-9.41622|-40.5033
2307304|juazeiro do norte|CE|-7.19621|-39.3076
2205516|juazeiro do piaui|PI|-5.17459|-41.6976
2307403|jucas|CE|-6.51523|-39.5187
2608255|jucati|PE|-8.70195|-36.4871
2918456|jucurucu|BA|-16.8488|-40.1641
2406106|jucurutu|RN|-6.0306|-37.009
5105150|juina|MT|-11.3728|-58.7483
3136702|juiz de fora|MG|-21.7595|-43.3398
2205524|julio borges|PI|-10.3225|-44.2381
4311205|julio de castilhos|RS|-29.2299|-53.6772
3525805|julio mesquita|SP|-22.0112|-49.7873
3525854|jumirim|SP|-23.0884|-47.7868
2105658|junco do maranhao|MA|-1.83888|-46.09
2507804|junco do serido|PB|-6.99269|-36.7166
2406155|jundia|RN|-6.26866|-35.3495
2703908|jundia|AL|-8.93297|-35.5669
3525904|jundiai|SP|-23.1852|-46.8974
4112900|jundiai do sul|PR|-23.4357|-50.2496
2704005|junqueiro|AL|-9.90696|-36.4803
3526001|junqueiropolis|SP|-21.5103|-51.4342
2608305|jupi|PE|-8.70904|-36.4126
4209177|jupia|SC|-26.395|-52.7298
3526100|juquia|SP|-24.3101|-47.6426
3526209|juquitiba|SP|-23.9244|-47.0653
3136801|juramento|MG|-16.8473|-43.5865
4112959|juranda|PR|-24.4209|-52.8413
2608404|jurema|PE|-8.70714|-36.1347
2205532|jurema|PI|-9.21992|-43.1337
2507903|juripiranga|PB|-7.36176|-35.2321
2508000|juru|PB|-7.52983|-37.815
1302207|jurua|AM|-3.48438|-66.0718
3136900|juruaia|MG|-21.2493|-46.5735
5105176|juruena|MT|-10.3178|-58.3592
1503903|juruti|PA|-2.16347|-56.0889
5105200|juscimeira|MT|-16.0633|-54.8859
2918506|jussara|BA|-11.0431|-41.9702
5212204|jussara|GO|-15.8659|-50.8668
4113007|jussara|PR|-23.6219|-52.4693
2918555|jussari|BA|-15.192|-39.491
2918605|jussiape|BA|-13.5155|-41.5882
1302306|jutai|AM|-2.75814|-66.7595
5005152|juti|MS|-22.8596|-54.6061
3136959|juvenilia|MG|-14.2662|-44.1597
4113106|kalore|PR|-23.8188|-51.6687
1302405|labrea|AM|-7.26413|-64.7948
4209201|lacerdopolis|SC|-27.2579|-51.5577
3137007|ladainha|MG|-17.6279|-41.7488
5005202|ladario|MS|-19.0089|-57.5973
2918704|lafaiete coutinho|BA|-13.6541|-40.2119
3137106|lagamar|MG|-18.1759|-46.8063
2803500|lagarto|SE|-10.9136|-37.6689
4209300|lages|SC|-27.815|-50.3259
2105708|lago da pedra|MA|-4.56974|-45.1319
2105807|lago do junco|MA|-4.609|-45.049
2105948|lago dos rodrigues|MA|-4.61173|-44.9798
2105906|lago verde|MA|-3.94661|-44.826
2508109|lagoa|PB|-6.58572|-37.9127
2205557|lagoa alegre|PI|-4.51539|-42.6309
4311239|lagoa bonita do sul|RS|-29.4939|-53.017
2406205|lagoa d anta|RN|-6.39493|-35.5949
2704104|lagoa da canoa|AL|-9.83291|-36.7413
1711902|lagoa da confusao|TO|-10.7906|-49.6199
3137205|lagoa da prata|MG|-20.0237|-45.5401
2508208|lagoa de dentro|PB|-6.67213|-35.3706
2608503|lagoa de itaenga|PE|-7.93005|-35.2874
2406304|lagoa de pedras|RN|-6.15082|-35.4299
2205573|lagoa de sao francisco|PI|-4.38505|-41.5969
2406403|lagoa de velhos|RN|-6.0119|-35.8729
2205565|lagoa do barro do piaui|PI|-8.47673|-41.5342
2608453|lagoa do carro|PE|-7.84383|-35.3108
2105922|lagoa do mato|MA|-6.05023|-43.5333
2608602|lagoa do ouro|PE|-9.12567|-36.4584
2205581|lagoa do piaui|PI|-5.41864|-42.6437
2205599|lagoa do sitio|PI|-6.50766|-41.5653
1711951|lagoa do tocantins|TO|-10.368|-47.538
2608701|lagoa dos gatos|PE|-8.6602|-35.904
3137304|lagoa dos patos|MG|-16.978|-44.5754
4311270|lagoa dos tres cantos|RS|-28.5676|-52.8618
3137403|lagoa dourada|MG|-20.9139|-44.0797
3137502|lagoa formosa|MG|-18.7715|-46.4012
3137536|lagoa grande|MG|-17.8323|-46.5165
2608750|lagoa grande|PE|-8.99452|-40.2767
2105963|lagoa grande do maranhao|MA|-4.98893|-45.3816
2406502|lagoa nova|RN|-6.09339|-36.4703
2918753|lagoa real|BA|-14.0334|-42.1328
2406601|lagoa salgada|RN|-6.12295|-35.4724
5212253|lagoa santa|GO|-19.1832|-51.3998
3137601|lagoa santa|MG|-19.6397|-43.8932
2508307|lagoa seca|PB|-7.15535|-35.8491
4311304|lagoa vermelha|RS|-28.2093|-51.5248
4311254|lagoao|RS|-29.2348|-52.7997
3526308|lagoinha|SP|-23.0846|-45.1944
2205540|lagoinha do piaui|PI|-5.83074|-42.6223
4209409|laguna|SC|-28.4843|-48.7772
5005251|laguna carapa|MS|-22.5448|-55.1502
2918803|laje|BA|-13.1673|-39.4213
3302304|laje do muriae|RJ|-21.2091|-42.1271
1712009|lajeado|TO|-9.74996|-48.3565
4311403|lajeado|RS|-29.4591|-51.9644
4311429|lajeado do bugre|RS|-27.6913|-53.1818
4209458|lajeado grande|SC|-26.8576|-52.5648
2105989|lajeado novo|MA|-6.18539|-47.0293
2918902|lajedao|BA|-17.6056|-40.3383
2919009|lajedinho|BA|-12.3529|-40.9048
2608800|lajedo|PE|-8.65791|-36.3293
2919058|lajedo do tabocal|BA|-13.4663|-40.2204
2406700|lajes|RN|-5.69322|-36.247
2406809|lajes pintadas|RN|-6.14943|-36.1171
3137700|lajinha|MG|-20.1539|-41.6228
2919108|lamarao|BA|-11.773|-38.887
3137809|lambari|MG|-21.9671|-45.3498
5105234|lambari d oeste|MT|-15.3188|-58.0046
3137908|lamim|MG|-20.79|-43.4706
2205607|landri sales|PI|-7.25922|-43.9364
4113205|lapa|PR|-25.7671|-49.7168
2919157|lapao|BA|-11.3851|-41.8286
3203163|laranja da terra|ES|-19.8994|-41.0621
3138005|laranjal|MG|-21.3715|-42.4732
4113254|laranjal|PR|-24.8862|-52.47
1600279|laranjal do jari|AP|-0.804911|-52.453
3526407|laranjal paulista|SP|-23.0506|-47.8375
2803609|laranjeiras|SE|-10.7981|-37.1731
4113304|laranjeiras do sul|PR|-25.4077|-52.4109
3138104|lassance|MG|-17.887|-44.5735
2508406|lastro|PB|-6.50603|-38.1742
4209508|laurentino|SC|-27.2173|-49.7331
2919207|lauro de freitas|BA|-12.8978|-38.321
4209607|lauro muller|SC|-28.3859|-49.4035
1712157|lavandeira|TO|-12.7847|-46.5099
3526506|lavinia|SP|-21.1639|-51.0412
3138203|lavras|MG|-21.248|-45.0009
2307502|lavras da mangabeira|CE|-6.7448|-38.9706
4311502|lavras do sul|RS|-30.8071|-53.8931
3526605|lavrinhas|SP|-22.57|-44.9024
3138302|leandro ferreira|MG|-19.7193|-45.0279
4209706|lebon regis|SC|-26.928|-50.6921
3526704|leme|SP|-22.1809|-47.3841
3138351|leme do prado|MG|-17.0793|-42.6936
2919306|lencois|BA|-12.5616|-41.3928
3526803|lencois paulista|SP|-22.6027|-48.8037
4209805|leoberto leal|SC|-27.5081|-49.2789
3138401|leopoldina|MG|-21.5296|-42.6421
5212303|leopoldo de bulhoes|GO|-16.619|-48.7428
4113403|leopolis|PR|-23.0818|-50.7511
4311601|liberato salzano|RS|-27.601|-53.0753
3138500|liberdade|MG|-22.0275|-44.3208
2919405|licinio de almeida|BA|-14.6842|-42.5095
4113429|lidianopolis|PR|-24.11|-51.6506
2106003|lima campos|MA|-4.51837|-44.4646
3138609|lima duarte|MG|-21.8386|-43.7934
3526902|limeira|SP|-22.566|-47.397
3138625|limeira do oeste|MG|-19.5512|-50.5815
2608909|limoeiro|PE|-7.8726|-35.4402
2704203|limoeiro de anadia|AL|-9.74098|-36.5121
1504000|limoeiro do ajuru|PA|-1.8985|-49.3903
2307601|limoeiro do norte|CE|-5.14392|-38.0847
4113452|lindoeste|PR|-25.2596|-53.5733
3527009|lindoia|SP|-22.5226|-46.65
4209854|lindoia do sul|SC|-27.0545|-52.069
4311627|lindolfo collor|RS|-29.5859|-51.2141
4311643|linha nova|RS|-29.4679|-51.2003
3203205|linhares|ES|-19.3946|-40.0643
3527108|lins|SP|-21.6718|-49.7526
2508505|livramento|PB|-7.37113|-36.9491
2919504|livramento de nossa senhora|BA|-13.6369|-41.8432
1712405|lizarda|TO|-9.59002|-46.6738
4113502|loanda|PR|-22.9232|-53.1362
4113601|lobato|PR|-23.0058|-51.9524
2508554|logradouro|PB|-6.61191|-35.4384
4113700|londrina|PR|-23.304|-51.1691
3138658|lontra|MG|-15.9013|-44.306
4209904|lontras|SC|-27.1684|-49.535
3527207|lorena|SP|-22.7334|-45.1197
2106102|loreto|MA|-7.08111|-45.1451
3527256|lourdes|SP|-20.966|-50.2263
3527306|louveira|SP|-23.0856|-46.9484
5105259|lucas do rio verde|MT|-13.0588|-55.9042
3527405|lucelia|SP|-21.7182|-51.0215
2508604|lucena|PB|-6.90258|-34.8748
3527504|lucianopolis|SP|-22.4294|-49.522
5105309|luciara|MT|-11.2219|-50.6676
2406908|lucrecia|RN|-6.10525|-37.8134
3527603|luis antonio|SP|-21.55|-47.7801
2205706|luis correia|PI|-2.88438|-41.6641
2106201|luis domingues|MA|-1.27492|-45.867
2919553|luis eduardo magalhaes|BA|-12.0956|-45.7866
2407005|luis gomes|RN|-6.40588|-38.3899
3138674|luisburgo|MG|-20.4468|-42.0976
3138682|luislandia|MG|-16.1095|-44.5886
4210001|luiz alves|SC|-26.7151|-48.9322
4113734|luiziana|PR|-24.2853|-52.269
3527702|luiziania|SP|-21.6737|-50.3294
3138708|luminarias|MG|-21.5145|-44.9034
4113759|lunardelli|PR|-24.0821|-51.7368
3527801|lupercio|SP|-22.4146|-49.818
4113809|lupionopolis|PR|-22.755|-51.6601
3527900|lutecia|SP|-22.3384|-50.394
3138807|luz|MG|-19.7911|-45.6794
4210035|luzerna|SC|-27.1304|-51.4682
5212501|luziania|GO|-16.253|-47.95
2205805|luzilandia|PI|-3.4683|-42.3718
1712454|luzinopolis|TO|-6.17794|-47.8582
3302403|macae|RJ|-22.3768|-41.7848
2407104|macaiba|RN|-5.85229|-35.3552
2919603|macajuba|BA|-12.1326|-40.3571
4311718|macambara|RS|-29.1445|-56.0674
2803708|macambira|SE|-10.6619|-37.5413
1600303|macapa|AP|0.034934|-51.0694
2609006|macaparana|PE|-7.55564|-35.4425
2919702|macarani|BA|-15.5646|-40.4209
3528007|macatuba|SP|-22.5002|-48.7102
2407203|macau|RN|-5.10795|-36.6318
3528106|macaubal|SP|-20.8022|-49.9687
2919801|macaubas|BA|-13.0186|-42.6945
3528205|macedonia|SP|-20.1444|-50.1973
2704302|maceio|AL|-9.66599|-35.735
3138906|machacalis|MG|-17.0723|-40.7245
4311700|machadinho|RS|-27.5667|-51.6668
1100130|machadinho d oeste|RO|-9.44363|-61.9818
3139003|machado|MG|-21.6778|-45.9219
2609105|machados|PE|-7.68827|-35.5114
4210050|macieira|SC|-26.8552|-51.3705
3302452|macuco|RJ|-21.9813|-42.2533
2919900|macurure|BA|-9.16226|-39.0518
2307635|madalena|CE|-4.84601|-39.5725
2205854|madeiro|PI|-3.48624|-42.4981
2919926|madre de deus|BA|-12.7446|-38.6153
3139102|madre de deus de minas|MG|-21.483|-44.3287
2508703|mae d agua|PB|-7.25201|-37.4322
1504059|mae do rio|PA|-2.05683|-47.5601
2919959|maetinga|BA|-14.6623|-41.4915
4210100|mafra|SC|-26.1159|-49.8086
1504109|magalhaes barata|PA|-0.803391|-47.6014
2106300|magalhaes de almeida|MA|-3.39232|-42.2117
3528304|magda|SP|-20.6445|-50.2305
3302502|mage|RJ|-22.6632|-43.0315
2920007|maiquinique|BA|-15.624|-40.2587
2920106|mairi|BA|-11.7107|-40.1437
3528403|mairinque|SP|-23.5398|-47.185
3528502|mairipora|SP|-23.3171|-46.5897
5212600|mairipotaba|GO|-17.2975|-49.4898
4210209|major gercino|SC|-27.4192|-48.9488
2704401|major isidoro|AL|-9.53009|-36.992
2407252|major sales|RN|-6.39949|-38.324
4210308|major vieira|SC|-26.3709|-50.3266
3139201|malacacheta|MG|-17.8456|-42.0769
2920205|malhada|BA|-14.3371|-43.7686
2920304|malhada de pedras|BA|-14.3847|-41.8842
2803807|malhada dos bois|SE|-10.3418|-36.9252
2803906|malhador|SE|-10.6649|-37.3004
4113908|mallet|PR|-25.8806|-50.8173
2508802|malta|PB|-6.89719|-37.5221
2508901|mamanguape|PB|-6.8337|-35.1213
5212709|mambai|GO|-14.4823|-46.1165
4114005|mambore|PR|-24.317|-52.5271
3139250|mamonas|MG|-15.0479|-42.9469
4311734|mampituba|RS|-29.2136|-49.9311
1302504|manacapuru|AM|-3.29066|-60.6216
2509008|manaira|PB|-7.70331|-38.1523
1302553|manaquiri|AM|-3.44078|-60.4612
2609154|manari|PE|-8.9649|-37.6313
1302603|manaus|AM|-3.11866|-60.0212
1200336|mancio lima|AC|-7.61657|-72.8997
4114104|mandaguacu|PR|-23.3458|-52.0944
4114203|mandaguari|PR|-23.5446|-51.671
4114302|mandirituba|PR|-25.777|-49.3282
3528601|manduri|SP|-23.0056|-49.3202
4114351|manfrinopolis|PR|-26.1441|-53.3113
3139300|manga|MG|-14.7529|-43.9391
3302601|mangaratiba|RJ|-22.9594|-44.0409
4114401|mangueirinha|PR|-25.9421|-52.1743
3139409|manhuacu|MG|-20.2572|-42.028
3139508|manhumirim|MG|-20.3591|-41.9589
1302702|manicore|AM|-5.80462|-61.2895
2205904|manoel emidio|PI|-8.01234|-43.8755
4114500|manoel ribas|PR|-24.5144|-51.6658
1200344|manoel urbano|AC|-8.83291|-69.2679
4311759|manoel viana|RS|-29.5859|-55.4841
2920403|manoel vitorino|BA|-14.1476|-40.2399
2920452|mansidao|BA|-10.7227|-44.0428
3139607|mantena|MG|-18.7761|-40.9874
3203304|mantenopolis|ES|-18.8594|-41.124
4311775|maquine|RS|-29.6798|-50.2079
3139805|mar de espanha|MG|-21.8707|-43.0062
2704906|mar vermelho|AL|-9.44739|-36.3881
5212808|mara rosa|GO|-14.0148|-49.1777
1302801|maraa|AM|-1.85313|-65.573
1504208|maraba|PA|-5.38075|-49.1327
3528700|maraba paulista|SP|-22.1068|-51.9617
2106326|maracacume|MA|-2.04918|-45.9587
3528809|maracai|SP|-22.6149|-50.6713
4210407|maracaja|SC|-28.8463|-49.4605
5005400|maracaju|MS|-21.6105|-55.1678
1504307|maracana|PA|-0.778899|-47.452
2307650|maracanau|CE|-3.86699|-38.6259
2920502|maracas|BA|-13.4355|-40.4323
2704500|maragogi|AL|-9.00744|-35.2267
2920601|maragogipe|BA|-12.776|-38.9175
2609204|maraial|PE|-8.79062|-35.8266
2106359|maraja do sena|MA|-4.62806|-45.4531
2307700|maranguape|CE|-3.89143|-38.6829
2106375|maranhaozinho|MA|-2.24078|-45.8507
1504406|marapanim|PA|-0.714702|-47.7034
3528858|marapoama|SP|-21.2587|-49.13
4311791|marata|RS|-29.5457|-51.5573
3203320|marataizes|ES|-21.0398|-40.8384
4311809|marau|RS|-28.4498|-52.1986
2920700|marau|BA|-14.1035|-39.0137
2704609|maravilha|AL|-9.23045|-37.3524
4210506|maravilha|SC|-26.7665|-53.1737
3139706|maravilhas|MG|-19.5076|-44.6779
2509057|marcacao|PB|-6.76535|-35.0087
5105580|marcelandia|MT|-11.0463|-54.4377
4311908|marcelino ramos|RS|-27.4676|-51.9095
2407302|marcelino vieira|RN|-6.2846|-38.1642
2920809|marcionilio souza|BA|-13.0064|-40.5295
2307809|marco|CE|-3.1285|-40.1582
2205953|marcolandia|PI|-7.44169|-40.6602
2206001|marcos parente|PI|-7.11565|-43.8926
4114609|marechal candido rondon|PR|-24.557|-54.0571
2704708|marechal deodoro|AL|-9.70971|-35.8967
3203346|marechal floriano|ES|-20.4159|-40.67
1200351|marechal thaumaturgo|AC|-8.93898|-72.7997
4210555|marema|SC|-26.8024|-52.6264
2509107|mari|PB|-7.05942|-35.318
3139904|maria da fe|MG|-22.3044|-45.3773
4114708|maria helena|PR|-23.6158|-53.2053
4114807|marialva|PR|-23.4843|-51.7928
3140001|mariana|MG|-20.3765|-43.414
4311981|mariana pimentel|RS|-30.353|-51.5803
4312005|mariano moro|RS|-27.3568|-52.1467
1712504|marianopolis do tocantins|TO|-9.79377|-49.6553
3528908|mariapolis|SP|-21.7959|-51.1824
2704807|maribondo|AL|-9.58353|-36.3045
3302700|marica|RJ|-22.9354|-42.8246
3140100|marilac|MG|-18.5079|-42.0822
3203353|marilandia|ES|-19.4114|-40.5456
4114906|marilandia do sul|PR|-23.7425|-51.3137
4115002|marilena|PR|-22.7336|-53.0402
3529005|marilia|SP|-22.2171|-49.9501
4115101|mariluz|PR|-24.0089|-53.1432
4115200|maringa|PR|-23.4205|-51.9333
3529104|marinopolis|SP|-20.4389|-50.8254
3140159|mario campos|MG|-20.0582|-44.1883
4115309|mariopolis|PR|-26.355|-52.5532
4115358|maripa|PR|-24.42|-53.8286
3140209|maripa de minas|MG|-21.6979|-42.9546
1504422|marituba|PA|-1.36002|-48.3421
2509156|marizopolis|PB|-6.82748|-38.3528
3140308|marlieria|MG|-19.7096|-42.7327
4115408|marmeleiro|PR|-26.1472|-53.0267
3140407|marmelopolis|MG|-22.447|-45.1645
4312054|marques de souza|RS|-29.3311|-52.0973
4115457|marquinho|PR|-25.112|-52.2497
3140506|martinho campos|MG|-19.3306|-45.2434
2307908|martinopole|CE|-3.2252|-40.6896
3529203|martinopolis|SP|-22.1462|-51.1709
2407401|martins|RN|-6.08279|-37.908
3140530|martins soares|MG|-20.2546|-41.8786
2804003|maruim|SE|-10.7308|-37.0856
4115507|marumbi|PR|-23.7058|-51.6404
5212907|marzagao|GO|-17.983|-48.6415
2920908|mascote|BA|-15.5542|-39.3016
2308005|massape|CE|-3.52364|-40.3423
2206050|massape do piaui|PI|-7.47469|-41.1103
2509206|massaranduba|PB|-7.18995|-35.7848
4210605|massaranduba|SC|-26.6109|-49.0054
4312104|mata|RS|-29.5649|-54.4641
2921005|mata de sao joao|BA|-12.5307|-38.3009
2705002|mata grande|AL|-9.11824|-37.7323
2106409|mata roma|MA|-3.62035|-43.1112
3140555|mata verde|MG|-15.6869|-40.7366
3529302|matao|SP|-21.6025|-48.364
2509305|mataraca|PB|-6.59673|-35.0531
1712702|mateiros|TO|-10.5464|-46.4168
4115606|matelandia|PR|-25.2496|-53.9935
3140605|materlandia|MG|-18.4699|-43.0579
3140704|mateus leme|MG|-19.9794|-44.4318
3171501|mathias lobato|MG|-18.59|-41.9166
3140803|matias barbosa|MG|-21.869|-43.3135
3140852|matias cardoso|MG|-14.8563|-43.9146
2206100|matias olimpio|PI|-3.71492|-42.5507
2921054|matina|BA|-13.9109|-42.8439
2106508|matinha|MA|-3.09849|-45.035
2509339|matinhas|PB|-7.12486|-35.7669
4115705|matinhos|PR|-25.8237|-48.549
3140902|matipo|MG|-20.2873|-42.3401
4312138|mato castelhano|RS|-28.28|-52.1932
2509370|mato grosso|PB|-6.54018|-37.7279
4312153|mato leitao|RS|-29.5285|-52.1278
4312179|mato queimado|RS|-28.252|-54.6159
4115739|mato rico|PR|-24.6995|-52.1454
3141009|mato verde|MG|-15.3944|-42.86
2106607|matoes|MA|-5.51359|-43.2018
2106631|matoes do norte|MA|-3.6244|-44.5468
4210704|matos costa|SC|-26.4709|-51.1501
3141108|matozinhos|MG|-19.5543|-44.0868
5212956|matrincha|GO|-15.4342|-50.7456
2705101|matriz de camaragibe|AL|-9.15437|-35.5243
5105606|matupa|MT|-10.1821|-54.9467
2509396|matureia|PB|-7.26188|-37.351
3141207|matutina|MG|-19.2179|-45.9664
3529401|maua|SP|-23.6677|-46.4613
4115754|maua da serra|PR|-23.8988|-51.2277
1302900|maues|AM|-3.39289|-57.7067
5213004|maurilandia|GO|-17.9719|-50.3388
1712801|maurilandia do tocantins|TO|-5.95169|-47.5125
2308104|mauriti|CE|-7.38597|-38.7708
2407500|maxaranguape|RN|-5.52181|-35.2631
4312203|maximiliano de almeida|RS|-27.6325|-51.802
1600402|mazagao|AP|-0.11336|-51.2891
3141306|medeiros|MG|-19.9865|-46.2181
2921104|medeiros neto|BA|-17.3707|-40.2238
4115804|medianeira|PR|-25.2977|-54.0943
1504455|medicilandia|PA|-3.44637|-52.8875
3141405|medina|MG|-16.2245|-41.4728
4210803|meleiro|SC|-28.8244|-49.6378
1504505|melgaco|PA|-1.8032|-50.7149
3302809|mendes|RJ|-22.5245|-43.7312
3141504|mendes pimentel|MG|-18.6631|-41.4052
3529500|mendonca|SP|-21.1757|-49.5791
4115853|mercedes|PR|-24.4538|-54.1618
3141603|merces|MG|-21.1976|-43.3337
3529609|meridiano|SP|-20.3579|-50.1811
2308203|meruoca|CE|-3.53974|-40.4531
3529658|mesopolis|SP|-19.9684|-50.6326
3302858|mesquita|RJ|-22.8028|-43.4601
3141702|mesquita|MG|-19.224|-42.6079
2705200|messias|AL|-9.39384|-35.8392
2407609|messias targino|RN|-6.07194|-37.5158
2206209|miguel alves|PI|-4.16857|-42.8963
2921203|miguel calmon|BA|-11.4299|-40.6031
2206308|miguel leao|PI|-5.68077|-42.7436
3302908|miguel pereira|RJ|-22.4572|-43.4803
3529708|miguelopolis|SP|-20.1796|-48.031
2308302|milagres|CE|-7.29749|-38.9378
2921302|milagres|BA|-12.8646|-39.8611
2106672|milagres do maranhao|MA|-3.57443|-42.6131
2308351|milha|CE|-5.67252|-39.1875
2206357|milton brandao|PI|-4.68295|-41.4173
5213053|mimoso de goias|GO|-15.0515|-48.1611
3203403|mimoso do sul|ES|-21.0628|-41.3615
5213087|minacu|GO|-13.5304|-48.2206
2705309|minador do negrao|AL|-9.31236|-36.8696
4312252|minas do leao|RS|-30.1346|-52.0423
3141801|minas novas|MG|-17.2156|-42.5884
3141900|minduri|MG|-21.6797|-44.6051
5213103|mineiros|GO|-17.5654|-52.5537
3529807|mineiros do tiete|SP|-22.412|-48.451
1101203|ministro andreazza|RO|-11.196|-61.5174
3530003|mira estrela|SP|-19.9789|-50.139
3142007|mirabela|MG|-16.256|-44.1602
3529906|miracatu|SP|-24.2766|-47.4625
3303005|miracema|RJ|-21.4148|-42.1938
1713205|miracema do tocantins|TO|-9.56556|-48.393
2106706|mirador|MA|-6.37454|-44.3683
4115903|mirador|PR|-23.255|-52.7761
3142106|miradouro|MG|-20.8899|-42.3458
4312302|miraguai|RS|-27.497|-53.6891
3142205|mirai|MG|-21.2021|-42.6122
2308377|miraima|CE|-3.56867|-39.9663
5005608|miranda|MS|-20.2355|-56.3746
2106755|miranda do norte|MA|-3.56313|-44.5814
2609303|mirandiba|PE|-8.12113|-38.7388
3530102|mirandopolis|SP|-21.1313|-51.1035
2921401|mirangaba|BA|-10.961|-40.574
1713304|miranorte|TO|-9.52907|-48.5922
2921450|mirante|BA|-14.2385|-40.7718
1101302|mirante da serra|RO|-11.029|-62.6696
3530201|mirante do paranapanema|SP|-22.2904|-51.9084
4116000|miraselva|PR|-22.9657|-51.4846
3530300|mirassol|SP|-20.8169|-49.5206
5105622|mirassol d oeste|MT|-15.6759|-58.0951
3530409|mirassolandia|SP|-20.6179|-49.4617
3142254|miravania|MG|-14.7348|-44.4092
4210852|mirim doce|SC|-27.197|-50.0786
2106805|mirinzal|MA|-2.07094|-44.7787
4116059|missal|PR|-25.0919|-54.2477
2308401|missao velha|CE|-7.23522|-39.143
1504604|mocajuba|PA|-2.5831|-49.5042
3530508|mococa|SP|-21.4647|-47.0024
4210902|modelo|SC|-26.7729|-53.04
3142304|moeda|MG|-20.3399|-44.0509
3142403|moema|MG|-19.8387|-45.4127
2509404|mogeiro|PB|-7.28517|-35.4832
3530607|mogi das cruzes|SP|-23.5208|-46.1854
3530706|mogi guacu|SP|-22.3675|-46.9428
3530805|mogi mirim|SP|-22.4332|-46.9532
5213400|moipora|GO|-16.5434|-50.739
2804102|moita bonita|SE|-10.5769|-37.3512
1504703|moju|PA|-1.88993|-48.7668
1504752|mojui dos campos|PA|-2.6822|-54.6425
2308500|mombaca|CE|-5.73844|-39.63
3530904|mombuca|SP|-22.9285|-47.559
2106904|moncao|MA|-3.48125|-45.2496
3531001|moncoes|SP|-20.8509|-50.0975
4211009|mondai|SC|-27.1008|-53.4032
3531100|mongagua|SP|-24.0809|-46.6265
3142502|monjolos|MG|-18.3245|-44.118
2206407|monsenhor gil|PI|-5.562|-42.6075
2206506|monsenhor hipolito|PI|-6.99275|-41.026
3142601|monsenhor paulo|MG|-21.7579|-45.5391
2308609|monsenhor tabosa|CE|-4.79102|-40.0646
2509503|montadas|PB|-7.08848|-35.9592
3142700|montalvania|MG|-14.4197|-44.3719
3203502|montanha|ES|-18.1303|-40.3668
2407708|montanhas|RN|-6.48522|-35.2842
4312351|montauri|RS|-28.6462|-52.0767
1504802|monte alegre|PA|-1.99768|-54.0724
2407807|monte alegre|RN|-6.07063|-35.3253
5213509|monte alegre de goias|GO|-13.2552|-46.8928
3142809|monte alegre de minas|MG|-18.869|-48.881
2804201|monte alegre de sergipe|SE|-10.0256|-37.5616
2206605|monte alegre do piaui|PI|-9.75364|-45.3037
3531209|monte alegre do sul|SP|-22.6817|-46.681
4312377|monte alegre dos campos|RS|-28.6805|-50.7834
3531308|monte alto|SP|-21.2655|-48.4971
3531407|monte aprazivel|SP|-20.768|-49.7184
3142908|monte azul|MG|-15.1514|-42.8718
3531506|monte azul paulista|SP|-20.9065|-48.6387
3143005|monte belo|MG|-21.3271|-46.3635
4312385|monte belo do sul|RS|-29.1607|-51.6333
4211058|monte carlo|SC|-27.2239|-50.9808
3143104|monte carmelo|MG|-18.7302|-47.4912
4211108|monte castelo|SC|-26.461|-50.2327
3531605|monte castelo|SP|-21.2981|-51.5679
2407906|monte das gameleiras|RN|-6.43698|-35.7831
1713601|monte do carmo|TO|-10.7611|-48.1114
3143153|monte formoso|MG|-16.8691|-41.2473
2509602|monte horebe|PB|-7.20402|-38.5838
3531803|monte mor|SP|-22.945|-47.3122
1101401|monte negro|RO|-10.2458|-63.29
2921500|monte santo|BA|-10.4374|-39.3321
3143203|monte santo de minas|MG|-21.1873|-46.9753
1713700|monte santo do tocantins|TO|-10.0075|-48.9941
3143401|monte siao|MG|-22.4335|-46.573
2509701|monteiro|PB|-7.88363|-37.1184
3531704|monteiro lobato|SP|-22.9544|-45.8407
2705408|monteiropolis|AL|-9.60357|-37.2505
4312401|montenegro|RS|-29.6824|-51.4679
2107001|montes altos|MA|-5.83067|-47.0673
3143302|montes claros|MG|-16.7282|-43.8578
5213707|montes claros de goias|GO|-16.0059|-51.3979
3143450|montezuma|MG|-15.1702|-42.4941
5213756|montividiu|GO|-17.4439|-51.1728
5213772|montividiu do norte|GO|-13.3485|-48.6853
2308708|morada nova|CE|-5.09736|-38.3702
3143500|morada nova de minas|MG|-18.5998|-45.3584
2308807|moraujo|CE|-3.46311|-40.6776
2614303|moreilandia|PE|-7.61931|-39.546
4116109|moreira sales|PR|-24.0509|-53.0102
2609402|moreno|PE|-8.10871|-35.0835
4312427|mormaco|RS|-28.6968|-52.6999
2921609|morpara|BA|-11.5569|-43.2766
4116208|morretes|PR|-25.4744|-48.8345
5213806|morrinhos|GO|-17.7334|-49.1059
2308906|morrinhos|CE|-3.23426|-40.1233
4312443|morrinhos do sul|RS|-29.3578|-49.9328
3531902|morro agudo|SP|-20.7288|-48.0581
5213855|morro agudo de goias|GO|-15.3184|-50.0553
2206654|morro cabeca no tempo|PI|-9.71891|-43.9072
4211207|morro da fumaca|SC|-28.6511|-49.2169
3143609|morro da garca|MG|-18.5356|-44.601
2921708|morro do chapeu|BA|-11.5488|-41.1565
2206670|morro do chapeu do piaui|PI|-3.73337|-42.3024
3143708|morro do pilar|MG|-19.2236|-43.3795
4211256|morro grande|SC|-28.8006|-49.7214
4312450|morro redondo|RS|-31.5887|-52.6261
4312476|morro reuter|RS|-29.5379|-51.0811
2107100|morros|MA|-2.85379|-44.0357
2921807|mortugaba|BA|-15.0225|-42.3727
3532009|morungaba|SP|-22.8811|-46.7896
5213905|mossamedes|GO|-16.124|-50.2136
2408003|mossoro|RN|-5.18374|-37.3474
4312500|mostardas|RS|-31.1054|-50.9167
3532058|motuca|SP|-21.5103|-48.1538
5214002|mozarlandia|GO|-14.7457|-50.5713
1504901|muana|PA|-1.53936|-49.2224
1400308|mucajai|RR|2.43998|-60.9096
2309003|mucambo|CE|-3.90271|-40.7452
2921906|mucuge|BA|-13.0053|-41.3703
4312609|mucum|RS|-29.163|-51.8714
2922003|mucuri|BA|-18.0754|-39.5565
3203601|mucurici|ES|-18.0965|-40.52
4312617|muitos capoes|RS|-28.3132|-51.1836
4312625|muliterno|RS|-28.3253|-51.7697
2509800|mulungu|PB|-7.02525|-35.46
2309102|mulungu|CE|-4.30294|-38.9951
2922052|mulungu do morro|BA|-11.9648|-41.6374
2922102|mundo novo|BA|-11.8541|-40.4714
5005681|mundo novo|MS|-23.9355|-54.281
5214051|mundo novo|GO|-13.7729|-50.2814
3143807|munhoz|MG|-22.6092|-46.362
4116307|munhoz de melo|PR|-23.1487|-51.7737
2922201|muniz ferreira|BA|-13.0092|-39.1092
3203700|muniz freire|ES|-20.4652|-41.4156
2922250|muquem de sao francisco|BA|-12.065|-43.5497
3203809|muqui|ES|-20.9509|-41.346
3143906|muriae|MG|-21.13|-42.3693
2804300|muribeca|SE|-10.4271|-36.9588
2705507|murici|AL|-9.30682|-35.9428
2206696|murici dos portelas|PI|-3.319|-42.094
1713957|muricilandia|TO|-7.14669|-48.6091
2922300|muritiba|BA|-12.6329|-38.9921
3532108|murutinga do sul|SP|-20.9908|-51.2774
2922409|mutuipe|BA|-13.2284|-39.5044
3144003|mutum|MG|-19.8121|-41.4407
5214101|mutunopolis|GO|-13.7303|-49.2745
3144102|muzambinho|MG|-21.3692|-46.5213
3144201|nacip raydan|MG|-18.4544|-42.2481
3532157|nantes|SP|-22.6156|-51.24
3144300|nanuque|MG|-17.8481|-40.3533
4312658|nao me toque|RS|-28.4548|-52.8182
3144359|naque|MG|-19.2291|-42.3312
3532207|narandiba|SP|-22.4057|-51.5274
2408102|natal|RN|-5.79357|-35.1986
3144375|natalandia|MG|-16.5021|-46.4874
3144409|natercia|MG|-22.1158|-45.5123
1714203|natividade|TO|-11.7034|-47.7223
3303104|natividade|RJ|-21.039|-41.9697
3532306|natividade da serra|SP|-23.3707|-45.4468
2509909|natuba|PB|-7.63514|-35.5586
4211306|navegantes|SC|-26.8943|-48.6546
5005707|navirai|MS|-23.0618|-54.1995
2922508|nazare|BA|-13.0235|-39.0108
1714302|nazare|TO|-6.37496|-47.6643
2609501|nazare da mata|PE|-7.74149|-35.2193
2206704|nazare do piaui|PI|-6.97023|-42.6773
3532405|nazare paulista|SP|-23.1747|-46.3983
3144508|nazareno|MG|-21.2168|-44.6138
2510006|nazarezinho|PB|-6.9114|-38.322
2206720|nazaria|PI|-5.35128|-42.8153
5214408|nazario|GO|-16.5808|-49.8817
2804409|neopolis|SE|-10.3215|-36.585
3144607|nepomuceno|MG|-21.2324|-45.235
5214507|neropolis|GO|-16.4047|-49.2227
3532504|neves paulista|SP|-20.843|-49.6358
1303007|nhamunda|AM|-2.20793|-56.7112
3532603|nhandeara|SP|-20.6945|-50.0436
4312674|nicolau vergueiro|RS|-28.5298|-52.4676
2922607|nilo pecanha|BA|-13.604|-39.1091
3303203|nilopolis|RJ|-22.8057|-43.4233
2107209|nina rodrigues|MA|-3.46788|-43.9134
3144656|ninheira|MG|-15.3148|-41.7564
5005806|nioaque|MS|-21.1419|-55.8296
3532702|nipoa|SP|-20.9114|-49.7833
5214606|niquelandia|GO|-14.4662|-48.4599
2408201|nisia floresta|RN|-6.09329|-35.1991
3303302|niteroi|RJ|-22.8832|-43.1034
5105903|nobres|MT|-14.7192|-56.3284
4312708|nonoai|RS|-27.3689|-52.7756
2922656|nordestina|BA|-10.8192|-39.4297
1400407|normandia|RR|3.8853|-59.6204
5106000|nortelandia|MT|-14.454|-56.7945
2804458|nossa senhora aparecida|SE|-10.3944|-37.4517
2804508|nossa senhora da gloria|SE|-10.2158|-37.4211
2804607|nossa senhora das dores|SE|-10.4854|-37.1963
4116406|nossa senhora das gracas|PR|-22.9129|-51.7978
2804706|nossa senhora de lourdes|SE|-10.0772|-37.0615
2206753|nossa senhora de nazare|PI|-4.63019|-42.173
5106109|nossa senhora do livramento|MT|-15.772|-56.3432
2804805|nossa senhora do socorro|SE|-10.8468|-37.1231
2206803|nossa senhora dos remedios|PI|-3.97574|-42.6184
3532801|nova alianca|SP|-21.0156|-49.4986
4116505|nova alianca do ivai|PR|-23.1763|-52.6032
4312757|nova alvorada|RS|-28.6822|-52.1631
5006002|nova alvorada do sul|MS|-21.4657|-54.3825
5214705|nova america|GO|-15.0206|-49.8953
4116604|nova america da colina|PR|-23.3308|-50.7168
5006200|nova andradina|MS|-22.238|-53.3437
4312807|nova araca|RS|-28.6537|-51.7458
4116703|nova aurora|PR|-24.5289|-53.2575
5214804|nova aurora|GO|-18.0597|-48.2552
5106158|nova bandeirantes|MT|-9.84977|-57.8139
4312906|nova bassano|RS|-28.7291|-51.7072
3144672|nova belem|MG|-18.4925|-41.1107
4312955|nova boa vista|RS|-27.9926|-52.9784
5106208|nova brasilandia|MT|-14.9612|-54.9685
1100148|nova brasilandia d oeste|RO|-11.7247|-62.3127
4313003|nova brescia|RS|-29.2182|-52.0319
3532827|nova campina|SP|-24.1224|-48.9022
2922706|nova canaa|BA|-14.7912|-40.1458
5106216|nova canaa do norte|MT|-10.558|-55.953
3532843|nova canaa paulista|SP|-20.3836|-50.9483
4313011|nova candelaria|RS|-27.6137|-54.1074
4116802|nova cantu|PR|-24.6723|-52.5661
3532868|nova castilho|SP|-20.7615|-50.3477
2107258|nova colinas|MA|-7.12263|-46.2607
5214838|nova crixas|GO|-14.0957|-50.33
2408300|nova cruz|RN|-6.47511|-35.4286
3144706|nova era|MG|-19.7577|-43.0333
4211405|nova erechim|SC|-26.8982|-52.9066
4116901|nova esperanca|PR|-23.182|-52.2031
1504950|nova esperanca do piria|PA|-2.26693|-46.9731
4116950|nova esperanca do sudoeste|PR|-25.9004|-53.2618
4313037|nova esperanca do sul|RS|-29.4066|-54.8293
3532900|nova europa|SP|-21.7765|-48.5705
4117008|nova fatima|PR|-23.4324|-50.5665
2922730|nova fatima|BA|-11.6031|-39.6302
2510105|nova floresta|PB|-6.45056|-36.2057
3303401|nova friburgo|RJ|-22.2932|-42.5377
5214861|nova gloria|GO|-15.145|-49.5737
3533007|nova granada|SP|-20.5321|-49.3123
5108808|nova guarita|MT|-10.312|-55.4061
3533106|nova guataporanga|SP|-21.332|-51.6447
4313060|nova hartz|RS|-29.5808|-50.9051
2922755|nova ibia|BA|-13.812|-39.6182
3303500|nova iguacu|RJ|-22.7556|-43.4603
5214879|nova iguacu de goias|GO|-14.2868|-49.3872
3533205|nova independencia|SP|-21.1026|-51.4905
2107308|nova iorque|MA|-6.73047|-44.0471
1504976|nova ipixuna|PA|-4.91622|-49.0822
4211454|nova itaberaba|SC|-26.9428|-52.8141
2922805|nova itarana|BA|-13.0241|-40.0653
5106182|nova lacerda|MT|-14.4727|-59.6001
4117057|nova laranjeiras|PR|-25.3054|-52.5447
3144805|nova lima|MG|-19.9758|-43.8509
4117107|nova londrina|PR|-22.7639|-52.9868
3533304|nova luzitania|SP|-20.856|-50.2617
1100338|nova mamore|RO|-10.4077|-65.3346
5108857|nova marilandia|MT|-14.3568|-56.9696
5108907|nova maringa|MT|-13.0136|-57.0908
3144904|nova modica|MG|-18.4417|-41.4984
5108956|nova monte verde|MT|-9.99998|-57.5261
5106224|nova mutum|MT|-13.8374|-56.0743
5106174|nova nazare|MT|-13.9486|-51.8002
3533403|nova odessa|SP|-22.7832|-47.2941
4117206|nova olimpia|PR|-23.4703|-53.0898
5106232|nova olimpia|MT|-14.7889|-57.2886
1714880|nova olinda|TO|-7.63171|-48.4252
2309201|nova olinda|CE|-7.08415|-39.6713
2510204|nova olinda|PB|-7.47232|-38.0382
2107357|nova olinda do maranhao|MA|-2.84227|-45.6953
1303106|nova olinda do norte|AM|-3.90037|-59.094
4313086|nova padua|RS|-29.0275|-51.3098
4313102|nova palma|RS|-29.471|-53.4689
2510303|nova palmeira|PB|-6.67122|-36.422
4313201|nova petropolis|RS|-29.3741|-51.1136
3145000|nova ponte|MG|-19.1461|-47.6779
3145059|nova porteirinha|MG|-15.7993|-43.2941
4313300|nova prata|RS|-28.7799|-51.6113
4117255|nova prata do iguacu|PR|-25.6309|-53.3469
4313334|nova ramada|RS|-28.0667|-53.6992
2922854|nova redencao|BA|-12.815|-41.0748
3145109|nova resende|MG|-21.1286|-46.4157
5214903|nova roma|GO|-13.7388|-46.8734
4313359|nova roma do sul|RS|-28.9882|-51.4095
1715002|nova rosalandia|TO|-10.5651|-48.9125
2309300|nova russas|CE|-4.70581|-40.5621
4117214|nova santa barbara|PR|-23.5865|-50.7598
5106190|nova santa helena|MT|-10.8651|-55.1872
4313375|nova santa rita|RS|-29.8525|-51.2837
2207959|nova santa rita|PI|-8.09707|-42.0471
4117222|nova santa rosa|PR|-24.4693|-53.9552
3145208|nova serrana|MG|-19.8713|-44.9847
2922904|nova soure|BA|-11.2329|-38.4871
4117271|nova tebas|PR|-24.438|-51.9454
1505007|nova timboteua|PA|-1.20874|-47.3921
4211504|nova trento|SC|-27.278|-48.9298
5106240|nova ubirata|MT|-12.9834|-55.2556
3136603|nova uniao|MG|-19.6876|-43.583
1101435|nova uniao|RO|-10.9068|-62.5564
3203908|nova venecia|ES|-18.715|-40.4053
4211603|nova veneza|SC|-28.6338|-49.5055
5215009|nova veneza|GO|-16.3695|-49.3168
2923001|nova vicosa|BA|-17.8926|-39.3743
5106257|nova xavantina|MT|-14.6771|-52.3502
3533254|novais|SP|-20.9893|-48.9141
1715101|novo acordo|TO|-9.97063|-47.6785
1303205|novo airao|AM|-2.63637|-60.9434
1715150|novo alegre|TO|-12.9217|-46.5713
1303304|novo aripuana|AM|-5.12593|-60.3732
4313490|novo barreiro|RS|-27.9077|-53.1103
5215207|novo brasil|GO|-16.0313|-50.7113
4313391|novo cabrais|RS|-29.7338|-52.9489
3145307|novo cruzeiro|MG|-17.4654|-41.8826
5215231|novo gama|GO|-16.0592|-48.0417
4313409|novo hamburgo|RS|-29.6875|-51.1328
4211652|novo horizonte|SC|-26.4442|-52.8281
3533502|novo horizonte|SP|-21.4651|-49.2234
2923035|novo horizonte|BA|-12.8083|-42.1682
5106273|novo horizonte do norte|MT|-11.4089|-57.3488
1100502|novo horizonte do oeste|RO|-11.6961|-61.9951
5006259|novo horizonte do sul|MS|-22.6693|-53.8601
4117297|novo itacolomi|PR|-23.7631|-51.5079
1715259|novo jardim|TO|-11.826|-46.6325
2705606|novo lino|AL|-8.94191|-35.664
4313425|novo machado|RS|-27.5765|-54.5036
5106265|novo mundo|MT|-9.95616|-55.2029
2309409|novo oriente|CE|-5.52552|-40.7713
3145356|novo oriente de minas|MG|-17.4089|-41.2194
2206902|novo oriente do piaui|PI|-6.44901|-41.9261
5215256|novo planalto|GO|-13.2424|-49.506
1505031|novo progresso|PA|-7.14347|-55.3786
1505064|novo repartimento|PA|-4.24749|-49.9499
2206951|novo santo antonio|PI|-5.28749|-41.9325
5106315|novo santo antonio|MT|-12.2875|-50.9686
5106281|novo sao joaquim|MT|-14.9054|-53.0194
4313441|novo tiradentes|RS|-27.5649|-53.1837
2923050|novo triunfo|BA|-10.3182|-38.4014
4313466|novo xingu|RS|-27.749|-53.0639
3145372|novorizonte|MG|-16.0162|-42.4044
3533601|nuporanga|SP|-20.7296|-47.7429
1505106|obidos|PA|-1.90107|-55.5208
2309458|ocara|CE|-4.48523|-38.5933
3533700|ocaucu|SP|-22.438|-49.922
2207009|oeiras|PI|-7.01915|-42.1283
1505205|oeiras do para|PA|-2.00358|-49.8628
1600501|oiapoque|AP|3.84074|-51.8331
3145406|olaria|MG|-21.8598|-43.9356
3533809|oleo|SP|-22.9435|-49.3419
2510402|olho d agua|PB|-7.22118|-37.7406
2107407|olho d agua das cunhas|MA|-4.13417|-45.1163
2705705|olho d agua das flores|AL|-9.53686|-37.2971
2705804|olho d agua do casado|AL|-9.50357|-37.8301
2207108|olho d agua do piaui|PI|-5.84125|-42.5594
2705903|olho d agua grande|AL|-10.0572|-36.8101
2408409|olho d agua do borges|RN|-5.9486|-37.7047
3145455|olhos d agua|MG|-17.3982|-43.5719
3533908|olimpia|SP|-20.7366|-48.9106
3145505|olimpio noronha|MG|-22.0685|-45.2657
2609600|olinda|PE|-8.01017|-34.8545
2107456|olinda nova do maranhao|MA|-2.99295|-44.9897
2923100|olindina|BA|-11.3497|-38.3379
2510501|olivedos|PB|-6.98434|-36.241
3145604|oliveira|MG|-20.6982|-44.829
1715507|oliveira de fatima|TO|-10.707|-48.9086
2923209|oliveira dos brejinhos|BA|-12.3132|-42.8969
3145703|oliveira fortes|MG|-21.3401|-43.4499
2706000|olivenca|AL|-9.51954|-37.1954
3145802|onca de pitangui|MG|-19.7276|-44.8058
3534005|onda verde|SP|-20.6042|-49.2929
3145851|oratorios|MG|-20.4298|-42.7977
3534104|oriente|SP|-22.1549|-50.0971
3534203|orindiuva|SP|-20.1861|-49.3464
1505304|oriximina|PA|-1.75989|-55.8579
3145877|orizania|MG|-20.5142|-42.1991
5215306|orizona|GO|-17.0334|-48.2964
3534302|orlandia|SP|-20.7169|-47.8852
4211702|orleans|SC|-28.3487|-49.2986
2609709|orobo|PE|-7.74553|-35.5956
2609808|oroco|PE|-8.61026|-39.6026
2309508|oros|CE|-6.25182|-38.9053
4117305|ortigueira|PR|-24.2058|-50.9185
3534401|osasco|SP|-23.5324|-46.7916
3534500|oscar bressane|SP|-22.3149|-50.2811
4313508|osorio|RS|-29.8881|-50.2667
3534609|osvaldo cruz|SP|-21.7968|-50.8793
4211751|otacilio costa|SC|-27.4789|-50.1231
1505403|ourem|PA|-1.54168|-47.1126
2923308|ouricangas|BA|-12.0175|-38.6166
2609907|ouricuri|PE|-7.87918|-40.08
1505437|ourilandia do norte|PA|-6.7529|-51.0858
3534708|ourinhos|SP|-22.9797|-49.8697
4117404|ourizona|PR|-23.4053|-52.1964
4211801|ouro|SC|-27.3379|-51.6194
3145901|ouro branco|MG|-20.5263|-43.6962
2408508|ouro branco|RN|-6.6958|-36.9428
2706109|ouro branco|AL|-9.15884|-37.3556
3146008|ouro fino|MG|-22.2779|-46.3716
3146107|ouro preto|MG|-20.3796|-43.512
1100155|ouro preto do oeste|RO|-10.7167|-62.2565
2510600|ouro velho|PB|-7.61604|-37.1519
4211850|ouro verde|SC|-26.692|-52.3108
3534807|ouro verde|SP|-21.4872|-51.7024
5215405|ouro verde de goias|GO|-16.2181|-49.1942
3146206|ouro verde de minas|MG|-18.0719|-41.2734
4117453|ouro verde do oeste|PR|-24.7933|-53.9043
3534757|ouroeste|SP|-20.0061|-50.3768
2923357|ourolandia|BA|-10.9578|-41.0756
5215504|ouvidor|GO|-18.2277|-47.8355
3534906|pacaembu|SP|-21.5627|-51.2654
1505486|pacaja|PA|-3.83542|-50.6399
2309607|pacajus|CE|-4.17107|-38.465
1400456|pacaraima|RR|4.4799|-61.1477
2309706|pacatuba|CE|-3.9784|-38.6183
2804904|pacatuba|SE|-10.4538|-36.6531
2107506|paco do lumiar|MA|-2.51657|-44.1019
2309805|pacoti|CE|-4.22492|-38.922
2309904|pacuja|CE|-3.98327|-40.6989
5215603|padre bernardo|GO|-15.1605|-48.2833
3146255|padre carvalho|MG|-16.3646|-42.5088
2207207|padre marcos|PI|-7.35101|-40.8997
3146305|padre paraiso|MG|-17.0758|-41.4821
2207306|paes landim|PI|-7.77375|-42.2474
3146552|pai pedro|MG|-15.5271|-43.07
4211876|paial|SC|-27.2541|-52.4975
4117503|paicandu|PR|-23.4555|-52.046
4313607|paim filho|RS|-27.7075|-51.763
3146404|paineiras|MG|-18.8993|-45.5321
4211892|painel|SC|-27.9234|-50.0972
3146503|pains|MG|-20.3705|-45.6627
3146602|paiva|MG|-21.2913|-43.4088
2207355|pajeu do piaui|PI|-7.85508|-42.8248
2706208|palestina|AL|-9.67493|-37.339
3535002|palestina|SP|-20.39|-49.4309
5215652|palestina de goias|GO|-16.7392|-51.5309
1505494|palestina do para|PA|-5.74027|-48.3181
2310001|palhano|CE|-4.73672|-37.9655
4211900|palhoca|SC|-27.6455|-48.6697
3146701|palma|MG|-21.3748|-42.3123
4212007|palma sola|SC|-26.3471|-53.2771
2310100|palmacia|CE|-4.13831|-38.8446
2610004|palmares|PE|-8.68423|-35.589
4313656|palmares do sul|RS|-30.2535|-50.5103
3535101|palmares paulista|SP|-21.0854|-48.8037
4117602|palmas|PR|-26.4839|-51.9888
1721000|palmas|TO|-10.24|-48.3558
2923407|palmas de monte alto|BA|-14.2676|-43.1609
4117701|palmeira|PR|-25.4257|-50.007
4212056|palmeira|SC|-27.583|-50.1577
3535200|palmeira d oeste|SP|-20.4148|-50.7632
4313706|palmeira das missoes|RS|-27.9007|-53.3134
2207405|palmeira do piaui|PI|-8.73076|-44.2466
2706307|palmeira dos indios|AL|-9.40568|-36.6328
2207504|palmeirais|PI|-5.97086|-43.056
2107605|palmeirandia|MA|-2.64433|-44.8933
1715705|palmeirante|TO|-7.84786|-47.9242
2923506|palmeiras|BA|-12.5059|-41.5809
5215702|palmeiras de goias|GO|-16.8044|-49.924
1713809|palmeiras do tocantins|TO|-6.61658|-47.5464
2610103|palmeirina|PE|-9.0109|-36.3242
1715754|palmeiropolis|TO|-13.0447|-48.4026
5215801|palmelo|GO|-17.3258|-48.426
5215900|palminopolis|GO|-16.7924|-50.1652
3535309|palmital|SP|-22.7858|-50.218
4117800|palmital|PR|-24.8853|-52.2029
4313805|palmitinho|RS|-27.3596|-53.558
4212106|palmitos|SC|-27.0702|-53.1586
3146750|palmopolis|MG|-16.7364|-40.4296
4117909|palotina|PR|-24.2868|-53.8404
5216007|panama|GO|-18.1783|-49.355
4313904|panambi|RS|-28.2833|-53.5023
3204005|pancas|ES|-19.2229|-40.8534
2610202|panelas|PE|-8.66121|-36.0125
3535408|panorama|SP|-21.354|-51.8562
4313953|pantano grande|RS|-30.1902|-52.3729
2706406|pao de acucar|AL|-9.74032|-37.4403
3146909|papagaios|MG|-19.4419|-44.7468
4212205|papanduva|SC|-26.3777|-50.1419
2207553|paqueta|PI|-7.10303|-41.7
3147105|para de minas|MG|-19.8534|-44.6114
3303609|paracambi|RJ|-22.6078|-43.7108
3147006|paracatu|MG|-17.2252|-46.8711
2310209|paracuru|CE|-3.41436|-39.03
1505502|paragominas|PA|-3.00212|-47.3527
3147204|paraguacu|MG|-21.5465|-45.7374
3535507|paraguacu paulista|SP|-22.4114|-50.5732
4314001|parai|RS|-28.5964|-51.7896
3303708|paraiba do sul|RJ|-22.1585|-43.304
2107704|paraibano|MA|-6.4264|-43.9792
3535606|paraibuna|SP|-23.3872|-45.6639
2310258|paraipaba|CE|-3.43799|-39.1479
3535705|paraiso|SP|-21.0159|-48.7761
4212239|paraiso|SC|-26.62|-53.6716
5006275|paraiso das aguas|MS|-19.0216|-53.0116
4118006|paraiso do norte|PR|-23.2824|-52.6054
4314027|paraiso do sul|RS|-29.6717|-53.144
1716109|paraiso do tocantins|TO|-10.175|-48.8823
3147303|paraisopolis|MG|-22.5539|-45.7803
2310308|parambu|CE|-6.20768|-40.6905
2923605|paramirim|BA|-13.4388|-42.2395
2310407|paramoti|CE|-4.08815|-39.2417
1716208|parana|TO|-12.6167|-47.8734
2408607|parana|RN|-6.47565|-38.3057
4118105|paranacity|PR|-22.9297|-52.1549
4118204|paranagua|PR|-25.5161|-48.5225
5006309|paranaiba|MS|-19.6746|-51.1909
5216304|paranaiguara|GO|-18.9141|-50.6539
5106299|paranaita|MT|-9.65835|-56.4786
3535804|paranapanema|SP|-23.3862|-48.7214
4118303|paranapoema|PR|-22.6412|-52.0905
3535903|paranapua|SP|-20.1048|-50.5886
2610301|paranatama|PE|-8.91875|-36.6549
5106307|paranatinga|MT|-14.4265|-54.0524
4118402|paranavai|PR|-23.0816|-52.4617
5006358|paranhos|MS|-23.8911|-55.429
3147402|paraopeba|MG|-19.2732|-44.4044
3536000|parapua|SP|-21.7792|-50.7949
2510659|parari|PB|-7.30975|-36.6522
2923704|paratinga|BA|-12.687|-43.1798
3303807|paraty|RJ|-23.2221|-44.7175
2408706|parau|RN|-5.76893|-37.1032
1505536|parauapebas|PA|-6.06781|-49.9037
5216403|parauna|GO|-16.9463|-50.4484
2408805|parazinho|RN|-5.22276|-35.8398
3536109|pardinho|SP|-23.0841|-48.3679
4314035|pareci novo|RS|-29.6365|-51.3974
1101450|parecis|RO|-12.1754|-61.6032
2408904|parelhas|RN|-6.68491|-36.6566
2706422|pariconha|AL|-9.25634|-37.9988
1303403|parintins|AM|-2.63741|-56.729
2923803|paripiranga|BA|-10.6859|-37.8626
2706448|paripueira|AL|-9.46313|-35.552
3536208|pariquera acu|SP|-24.7147|-47.8742
3536257|parisi|SP|-20.3034|-50.0163
2207603|parnagua|PI|-10.2166|-44.63
2207702|parnaiba|PI|-2.90585|-41.7754
2403251|parnamirim|RN|-5.91116|-35.271
2610400|parnamirim|PE|-8.08729|-39.5795
2107803|parnarama|MA|-5.67365|-43.1011
4314050|parobe|RS|-29.6243|-50.8312
2409100|passa e fica|RN|-6.43018|-35.6442
3147600|passa quatro|MG|-22.3871|-44.9709
4314068|passa sete|RS|-29.4577|-52.9599
3147709|passa tempo|MG|-20.6539|-44.4926
3147808|passa vinte|MG|-22.2097|-44.2344
3147501|passabem|MG|-19.3509|-43.1383
2409209|passagem|RN|-6.27268|-35.37
2510709|passagem|PB|-7.13467|-37.0433
2107902|passagem franca|MA|-6.17745|-43.7755
2207751|passagem franca do piaui|PI|-5.86036|-42.4436
2610509|passira|PE|-7.9971|-35.5813
2706505|passo de camaragibe|AL|-9.24511|-35.4745
4212254|passo de torres|SC|-29.3099|-49.722
4314076|passo do sobrado|RS|-29.748|-52.2748
4314100|passo fundo|RS|-28.2576|-52.4091
3147907|passos|MG|-20.7193|-46.609
4212270|passos maia|SC|-26.7829|-52.0568
2108009|pastos bons|MA|-6.60296|-44.0745
3147956|patis|MG|-16.0773|-44.0787
4118451|pato bragado|PR|-24.6271|-54.2265
4118501|pato branco|PR|-26.2292|-52.6706
2510808|patos|PB|-7.01743|-37.2747
3148004|patos de minas|MG|-18.5699|-46.5013
2207777|patos do piaui|PI|-7.67231|-41.2408
3148103|patrocinio|MG|-18.9379|-46.9934
3148202|patrocinio do muriae|MG|-21.1544|-42.2125
3536307|patrocinio paulista|SP|-20.6384|-47.2801
2409308|patu|RN|-6.10656|-37.6356
3303856|paty do alferes|RJ|-22.4309|-43.4285
2923902|pau brasil|BA|-15.4572|-39.6458
1505551|pau d arco|PA|-1.59772|-46.9268
1716307|pau d arco|TO|-7.53919|-49.367
2207793|pau d arco do piaui|PI|-5.26072|-42.3908
2409407|pau dos ferros|RN|-6.10498|-38.2077
2610608|paudalho|PE|-7.90287|-35.1716
1303502|pauini|AM|-7.71311|-66.992
3148301|paula candido|MG|-20.8754|-42.9752
4118600|paula freitas|PR|-26.2105|-50.931
3536406|pauliceia|SP|-21.3153|-51.8321
3536505|paulinia|SP|-22.7542|-47.1488
2108058|paulino neves|MA|-2.72094|-42.5258
2510907|paulista|PB|-6.59138|-37.6185
2610707|paulista|PE|-7.93401|-34.8684
2207801|paulistana|PI|-8.13436|-41.1431
3536570|paulistania|SP|-22.5768|-49.4008
3148400|paulistas|MG|-18.4276|-42.8628
2924009|paulo afonso|BA|-9.3983|-38.2216
4314134|paulo bento|RS|-27.7051|-52.4169
3536604|paulo de faria|SP|-20.0296|-49.4
4118709|paulo frontin|PR|-26.0466|-50.8304
2706604|paulo jacinto|AL|-9.36792|-36.3672
4212304|paulo lopes|SC|-27.9607|-48.6864
2108108|paulo ramos|MA|-4.44485|-45.2398
3148509|pavao|MG|-17.4267|-41.0035
4314159|paverama|RS|-29.5486|-51.7339
2207850|pavussu|PI|-7.96059|-43.2284
2924058|pe de serra|BA|-11.8313|-39.611
4118808|peabiru|PR|-23.914|-52.3431
3148608|pecanha|MG|-18.5441|-42.5583
3536703|pederneiras|SP|-22.3511|-48.7781
2610806|pedra|PE|-8.49641|-36.94
3148707|pedra azul|MG|-16.0086|-41.2909
3536802|pedra bela|SP|-22.7902|-46.4455
3148756|pedra bonita|MG|-20.5219|-42.3304
2511004|pedra branca|PB|-7.42169|-38.0689
2310506|pedra branca|CE|-5.45341|-39.7078
1600154|pedra branca do amapari|AP|0.777424|-51.9503
3148806|pedra do anta|MG|-20.5968|-42.7123
3148905|pedra do indaia|MG|-20.2563|-45.2107
3149002|pedra dourada|MG|-20.8266|-42.1515
2409506|pedra grande|RN|-5.14988|-35.876
2511103|pedra lavrada|PB|-6.74997|-36.4758
2805000|pedra mole|SE|-10.6134|-37.6922
2409605|pedra preta|RN|-5.57352|-36.1084
5106372|pedra preta|MT|-16.6245|-54.4722
3149101|pedralva|MG|-22.2386|-45.4654
3536901|pedranopolis|SP|-20.2474|-50.1129
2924108|pedrao|BA|-12.1491|-38.6487
4314175|pedras altas|RS|-31.7365|-53.5814
2511202|pedras de fogo|PB|-7.39107|-35.1065
3149150|pedras de maria da cruz|MG|-15.6032|-44.391
4212403|pedras grandes|SC|-28.4339|-49.1949
3537008|pedregulho|SP|-20.2535|-47.4775
3537107|pedreira|SP|-22.7413|-46.8948
2108207|pedreiras|MA|-4.56482|-44.6006
2805109|pedrinhas|SE|-11.1902|-37.6775
3537156|pedrinhas paulista|SP|-22.8174|-50.7933
3149200|pedrinopolis|MG|-19.2241|-47.4579
1716505|pedro afonso|TO|-8.97034|-48.1729
2924207|pedro alexandre|BA|-10.012|-37.8932
2409704|pedro avelino|RN|-5.5161|-36.3867
3204054|pedro canario|ES|-18.3004|-39.9574
3537206|pedro de toledo|SP|-24.2764|-47.2354
2108256|pedro do rosario|MA|-2.97272|-45.3493
5006408|pedro gomes|MS|-18.0996|-54.5507
2207900|pedro ii|PI|-4.42585|-41.4482
2207934|pedro laurentino|PI|-8.06807|-42.2847
3149309|pedro leopoldo|MG|-19.6308|-44.0383
4314209|pedro osorio|RS|-31.8642|-52.8184
2512721|pedro regis|PB|-6.63323|-35.2966
3149408|pedro teixeira|MG|-21.7076|-43.743
2409803|pedro velho|RN|-6.4356|-35.2195
1716604|peixe|TO|-12.0254|-48.5395
1505601|peixe boi|PA|-1.19382|-47.324
5106422|peixoto de azevedo|MT|-10.2262|-54.9794
4314308|pejucara|RS|-28.4283|-53.6579
4314407|pelotas|RS|-31.7649|-52.3371
2310605|penaforte|CE|-7.82163|-39.0707
2108306|penalva|MA|-3.27674|-45.1768
3537305|penapolis|SP|-21.4148|-50.0769
2409902|pendencias|RN|-5.2564|-36.7095
2706703|penedo|AL|-10.2874|-36.5819
4212502|penha|SC|-26.7754|-48.6465
2310704|pentecoste|CE|-3.79274|-39.2692
3149507|pequeri|MG|-21.8341|-43.1145
3149606|pequi|MG|-19.6284|-44.6604
1716653|pequizeiro|TO|-8.5932|-48.9327
3149705|perdigao|MG|-19.9411|-45.078
3149804|perdizes|MG|-19.3434|-47.2963
3149903|perdoes|MG|-21.0932|-45.0896
3537404|pereira barreto|SP|-20.6368|-51.1123
3537503|pereiras|SP|-23.0804|-47.972
2310803|pereiro|CE|-6.03576|-38.4624
2108405|peri mirim|MA|-2.57676|-44.8504
3149952|periquito|MG|-19.1573|-42.2333
4212601|peritiba|SC|-27.3754|-51.9018
2108454|peritoro|MA|-4.37459|-44.3369
4118857|perobal|PR|-23.8949|-53.4098
4118907|perola|PR|-23.8039|-53.6834
4119004|perola d oeste|PR|-25.8278|-53.7433
5216452|perolandia|GO|-17.5258|-52.065
3537602|peruibe|SP|-24.312|-47.0012
3150000|pescador|MG|-18.357|-41.6006
4212650|pescaria brava|SC|-28.3966|-48.8864
2610905|pesqueira|PE|-8.35797|-36.6978
2611002|petrolandia|PE|-9.06863|-38.3027
4212700|petrolandia|SC|-27.5346|-49.6937
2611101|petrolina|PE|-9.38866|-40.5027
5216809|petrolina de goias|GO|-16.0968|-49.3364
3303906|petropolis|RJ|-22.52|-43.1926
2706802|piacabucu|AL|-10.406|-36.434
3537701|piacatu|SP|-21.5921|-50.6003
2511301|pianco|PB|-7.19282|-37.9289
2924306|piata|BA|-13.1465|-41.7702
3150109|piau|MG|-21.5096|-43.313
4314423|picada cafe|RS|-29.4464|-51.1367
1505635|picarra|PA|-6.43778|-48.8716
2208007|picos|PI|-7.07721|-41.467
2511400|picui|PB|-6.50845|-36.3497
3537800|piedade|SP|-23.7139|-47.4256
3150158|piedade de caratinga|MG|-19.7593|-42.0756
3150208|piedade de ponte nova|MG|-20.2438|-42.7379
3150307|piedade do rio grande|MG|-21.469|-44.1938
3150406|piedade dos gerais|MG|-20.4715|-44.2243
4119103|pien|PR|-26.0965|-49.4336
2924405|pilao arcado|BA|-10.0051|-42.4936
2511509|pilar|PB|-7.26403|-35.2523
2706901|pilar|AL|-9.60135|-35.9543
5216908|pilar de goias|GO|-14.7608|-49.5784
3537909|pilar do sul|SP|-23.8077|-47.7222
2410009|piloes|RN|-6.26364|-38.0461
2511608|piloes|PB|-6.86827|-35.613
2511707|piloezinhos|PB|-6.84277|-35.531
3150505|pimenta|MG|-20.4827|-45.8049
1100189|pimenta bueno|RO|-11.672|-61.198
2208106|pimenteiras|PI|-6.23839|-41.4113
1101468|pimenteiras do oeste|RO|-13.4823|-61.0471
2924504|pindai|BA|-14.4921|-42.686
3538006|pindamonhangaba|SP|-22.9246|-45.4613
2108504|pindare mirim|MA|-3.60985|-45.342
2707008|pindoba|AL|-9.47382|-36.2918
2924603|pindobacu|BA|-10.7433|-40.3675
3538105|pindorama|SP|-21.1853|-48.9086
1717008|pindorama do tocantins|TO|-11.1311|-47.5726
2310852|pindoretama|CE|-4.01584|-38.3061
3150539|pingo d agua|MG|-19.7287|-42.4095
4119152|pinhais|PR|-25.4429|-49.1927
4314456|pinhal|RS|-27.508|-53.2082
4314464|pinhal da serra|RS|-27.8751|-51.1673
4119251|pinhal de sao bento|PR|-26.0324|-53.482
4314472|pinhal grande|RS|-29.345|-53.3206
4119202|pinhalao|PR|-23.7982|-50.0536
3538204|pinhalzinho|SP|-22.7811|-46.5897
4212908|pinhalzinho|SC|-26.8495|-52.9913
2805208|pinhao|SE|-10.5677|-37.7242
4119301|pinhao|PR|-25.6944|-51.6536
3303955|pinheiral|RJ|-22.5172|-44.0022
4314498|pinheirinho do vale|RS|-27.2109|-53.608
2108603|pinheiro|MA|-2.52224|-45.0788
4314506|pinheiro machado|RS|-31.5794|-53.3798
4213005|pinheiro preto|SC|-27.0483|-51.2243
3204104|pinheiros|ES|-18.4141|-40.2171
2924652|pintadas|BA|-11.8117|-39.9009
4314548|pinto bandeira|RS|-29.0975|-51.4503
3150570|pintopolis|MG|-16.0572|-45.1402
2208205|pio ix|PI|-6.83002|-40.6083
2108702|pio xii|MA|-3.89315|-45.1759
3538303|piquerobi|SP|-21.8747|-51.7282
2310902|piquet carneiro|CE|-5.80025|-39.417
3538501|piquete|SP|-22.6069|-45.1869
3538600|piracaia|SP|-23.0525|-46.3594
5217104|piracanjuba|GO|-17.302|-49.017
3150604|piracema|MG|-20.5089|-44.4783
3538709|piracicaba|SP|-22.7338|-47.6476
2208304|piracuruca|PI|-3.93335|-41.7088
3304003|pirai|RJ|-22.6215|-43.9081
2924678|pirai do norte|BA|-13.759|-39.3836
4119400|pirai do sul|PR|-24.5306|-49.9433
3538808|piraju|SP|-23.1981|-49.3803
3150703|pirajuba|MG|-19.9092|-48.7027
3538907|pirajui|SP|-21.999|-49.4608
2805307|pirambu|SE|-10.7215|-36.8544
3150802|piranga|MG|-20.6834|-43.2967
3539004|pirangi|SP|-21.0886|-48.6607
3150901|pirangucu|MG|-22.5249|-45.4945
3151008|piranguinho|MG|-22.395|-45.5324
2707107|piranhas|AL|-9.624|-37.757
5217203|piranhas|GO|-16.4258|-51.8235
2108801|pirapemas|MA|-3.72041|-44.2216
3151107|pirapetinga|MG|-21.6554|-42.3434
4314555|pirapo|RS|-28.0439|-55.2001
3151206|pirapora|MG|-17.3392|-44.934
3539103|pirapora do bom jesus|SP|-23.3965|-46.9991
3539202|pirapozinho|SP|-22.2711|-51.4976
4119509|piraquara|PR|-25.4422|-49.0624
1717206|piraque|TO|-6.77302|-48.2958
3539301|pirassununga|SP|-21.996|-47.4257
4314605|piratini|RS|-31.4473|-53.0973
3539400|piratininga|SP|-22.4142|-49.1339
4213104|piratuba|SC|-27.4242|-51.7668
3151305|pirauba|MG|-21.2825|-43.0172
5217302|pirenopolis|GO|-15.8507|-48.9584
5217401|pires do rio|GO|-17.3019|-48.2768
2310951|pires ferreira|CE|-4.23922|-40.6442
2924702|piripa|BA|-14.9444|-41.7168
2208403|piripiri|PI|-4.27157|-41.7716
2924801|piritiba|BA|-11.73|-40.5587
2511806|pirpirituba|PB|-6.77922|-35.4906
4119608|pitanga|PR|-24.7588|-51.7596
3539509|pitangueiras|SP|-21.0132|-48.221
4119657|pitangueiras|PR|-23.2281|-51.5873
3151404|pitangui|MG|-19.6741|-44.8964
2511905|pitimbu|PB|-7.4664|-34.8151
1717503|pium|TO|-10.442|-49.1876
3204203|piuma|ES|-20.8334|-40.7268
3151503|piumhi|MG|-20.4762|-45.9589
1505650|placas|PA|-3.86813|-54.2124
1200385|placido de castro|AC|-10.2806|-67.1371
5217609|planaltina|GO|-15.452|-47.6089
4119707|planaltina do parana|PR|-23.0101|-52.9162
2924900|planaltino|BA|-13.2618|-40.3695
2925006|planalto|BA|-14.6654|-40.4718
4314704|planalto|RS|-27.3297|-53.0575
3539608|planalto|SP|-21.0342|-49.933
4119806|planalto|PR|-25.7211|-53.7642
4213153|planalto alegre|SC|-27.0704|-52.867
5106455|planalto da serra|MT|-14.6518|-54.7819
3151602|planura|MG|-20.1376|-48.7
3539707|platina|SP|-22.6371|-50.2104
3539806|poa|SP|-23.5333|-46.3473
2611200|pocao|PE|-8.18726|-36.7111
2108900|pocao de pedras|MA|-4.74626|-44.9432
2512002|pocinhos|PB|-7.06658|-36.0668
2410108|poco branco|RN|-5.62233|-35.6635
2512036|poco dantas|PB|-6.39876|-38.4909
4314753|poco das antas|RS|-29.4481|-51.6719
2707206|poco das trincheiras|AL|-9.30742|-37.2889
2512077|poco de jose de moura|PB|-6.56401|-38.5111
3151701|poco fundo|MG|-21.78|-45.9658
2805406|poco redondo|SE|-9.80616|-37.6833
2805505|poco verde|SE|-10.7151|-38.1813
2925105|pocoes|BA|-14.5234|-40.3634
5106505|pocone|MT|-16.266|-56.6261
3151800|pocos de caldas|MG|-21.78|-46.5692
3151909|pocrane|MG|-19.6208|-41.6334
2925204|pojuca|BA|-12.4303|-38.3374
3539905|poloni|SP|-20.7829|-49.8258
2512101|pombal|PB|-6.76606|-37.8003
2611309|pombos|PE|-8.13982|-35.3967
4213203|pomerode|SC|-26.7384|-49.1785
3540002|pompeia|SP|-22.107|-50.176
3152006|pompeu|MG|-19.2257|-45.0141
3540101|pongai|SP|-21.7396|-49.3604
1505700|ponta de pedras|PA|-1.39587|-48.8661
4119905|ponta grossa|PR|-25.0916|-50.1668
5006606|ponta pora|MS|-22.5296|-55.7203
3540200|pontal|SP|-21.0216|-48.0423
5106653|pontal do araguaia|MT|-15.9274|-52.3273
4119954|pontal do parana|PR|-25.6735|-48.5111
5217708|pontalina|GO|-17.5225|-49.4489
3540259|pontalinda|SP|-20.4396|-50.5258
4314779|pontao|RS|-28.0585|-52.6791
4213302|ponte alta|SC|-27.4835|-50.3764
1717800|ponte alta do bom jesus|TO|-12.0853|-46.4825
4213351|ponte alta do norte|SC|-27.1591|-50.4659
1717909|ponte alta do tocantins|TO|-10.7481|-47.5276
5106703|ponte branca|MT|-16.7584|-52.8369
3152105|ponte nova|MG|-20.4111|-42.8978
4314787|ponte preta|RS|-27.6587|-52.4848
4213401|ponte serrada|SC|-26.8733|-52.0112
5106752|pontes e lacerda|MT|-15.2219|-59.3435
3540309|pontes gestal|SP|-20.1727|-49.7064
3204252|ponto belo|ES|-18.1253|-40.5458
3152131|ponto chique|MG|-16.6282|-45.0588
3152170|ponto dos volantes|MG|-16.7473|-41.5025
2925253|ponto novo|BA|-10.8653|-40.1311
3540408|populina|SP|-19.9453|-50.538
2311009|poranga|CE|-4.74672|-40.9205
3540507|porangaba|SP|-23.1761|-48.1195
5218003|porangatu|GO|-13.4391|-49.1503
3304102|porciuncula|RJ|-20.9632|-42.0465
4120002|porecatu|PR|-22.7537|-51.3795
2410207|portalegre|RN|-6.02064|-37.9865
4314803|portao|RS|-29.7015|-51.2429
5218052|porteirao|GO|-17.8143|-50.1653
2311108|porteiras|CE|-7.52265|-39.114
3152204|porteirinha|MG|-15.7404|-43.0281
1505809|portel|PA|-1.93639|-50.8194
5218102|portelandia|GO|-17.3554|-52.6799
2208502|porto|PI|-3.88815|-42.6998
1200807|porto acre|AC|-9.58138|-67.5478
4314902|porto alegre|RS|-30.0318|-51.2065
5106778|porto alegre do norte|MT|-10.8761|-51.6357
2208551|porto alegre do piaui|PI|-6.96423|-44.1837
1718006|porto alegre do tocantins|TO|-11.618|-47.0621
4120101|porto amazonas|PR|-25.54|-49.8946
4120150|porto barreiro|PR|-25.5477|-52.4067
4213500|porto belo|SC|-27.1586|-48.5469
2707305|porto calvo|AL|-9.05195|-35.3987
2805604|porto da folha|SE|-9.91626|-37.2842
1505908|porto de moz|PA|-1.74691|-52.2361
2707404|porto de pedras|AL|-9.16006|-35.3049
2410256|porto do mangue|RN|-5.05441|-36.7887
5106802|porto dos gauchos|MT|-11.533|-57.4132
5106828|porto esperidiao|MT|-15.857|-58.4619
5106851|porto estrela|MT|-15.3235|-57.2204
3540606|porto feliz|SP|-23.2093|-47.5251
3540705|porto ferreira|SP|-21.8498|-47.487
3152303|porto firme|MG|-20.6642|-43.0834
2109007|porto franco|MA|-6.34149|-47.3962
1600535|porto grande|AP|0.71243|-51.4155
4315008|porto lucena|RS|-27.8569|-55.01
4315057|porto maua|RS|-27.5796|-54.6657
5006903|porto murtinho|MS|-21.6981|-57.8836
1718204|porto nacional|TO|-10.7027|-48.408
3304110|porto real|RJ|-22.4175|-44.2952
2707503|porto real do colegio|AL|-10.1849|-36.8376
4120200|porto rico|PR|-22.7747|-53.2677
2109056|porto rico do maranhao|MA|-1.85925|-44.5842
2925303|porto seguro|BA|-16.4435|-39.0643
4213609|porto uniao|SC|-26.2451|-51.0759
1100205|porto velho|RO|-8.76077|-63.8999
4315073|porto vera cruz|RS|-27.7405|-54.8994
4120309|porto vitoria|PR|-26.1674|-51.231
1200393|porto walter|AC|-8.26323|-72.7537
4315107|porto xavier|RS|-27.9082|-55.1379
5218300|posse|GO|-14.0859|-46.3704
3152402|pote|MG|-17.8077|-41.786
2311207|potengi|CE|-7.09154|-40.0233
3540754|potim|SP|-22.8343|-45.2552
2925402|potiragua|BA|-15.5943|-39.8638
3540804|potirendaba|SP|-21.0428|-49.3815
2311231|potiretama|CE|-5.71287|-38.1578
3152501|pouso alegre|MG|-22.2266|-45.9389
3152600|pouso alto|MG|-22.1964|-44.9748
4315131|pouso novo|RS|-29.1738|-52.2136
4213708|pouso redondo|SC|-27.2567|-49.9301
5107008|poxoreu|MT|-15.8299|-54.4208
3540853|pracinha|SP|-21.8496|-51.0868
1600550|pracuuba|AP|1.74543|-50.7892
2925501|prado|BA|-17.3364|-39.2227
4120333|prado ferreira|PR|-23.0357|-51.4429
3540903|pradopolis|SP|-21.3626|-48.0679
3152709|prados|MG|-21.0597|-44.0778
3541000|praia grande|SP|-24.0084|-46.4121
4213807|praia grande|SC|-29.1918|-49.9525
1718303|praia norte|TO|-5.39281|-47.8111
1506005|prainha|PA|-1.798|-53.4779
4120358|pranchita|PR|-26.0209|-53.7397
3152808|prata|MG|-19.3086|-48.9276
2512200|prata|PB|-7.68826|-37.0801
2208601|prata do piaui|PI|-5.67265|-42.2046
3541059|pratania|SP|-22.8112|-48.6636
3152907|pratapolis|MG|-20.7411|-46.8624
3153004|pratinha|MG|-19.739|-46.3755
3541109|presidente alves|SP|-22.0999|-49.4381
3541208|presidente bernardes|SP|-22.0082|-51.5565
3153103|presidente bernardes|MG|-20.7656|-43.1895
4213906|presidente castello branco|SC|-27.2218|-51.8089
4120408|presidente castelo branco|PR|-23.2782|-52.1536
2925600|presidente dutra|BA|-11.2923|-41.9843
2109106|presidente dutra|MA|-5.2898|-44.495
3541307|presidente epitacio|SP|-21.7651|-52.1111
1303536|presidente figueiredo|AM|-2.02981|-60.0234
4214003|presidente getulio|SC|-27.0474|-49.6246
2925709|presidente janio quadros|BA|-14.6885|-41.6798
3153202|presidente juscelino|MG|-18.6401|-44.06
2109205|presidente juscelino|MA|-2.91872|-44.0715
1718402|presidente kennedy|TO|-8.5406|-48.5062
3204302|presidente kennedy|ES|-21.0964|-41.0468
3153301|presidente kubitschek|MG|-18.6193|-43.5628
4315149|presidente lucena|RS|-29.5175|-51.1798
1100254|presidente medici|RO|-11.169|-61.8986
2109239|presidente medici|MA|-2.38991|-45.82
4214102|presidente nereu|SC|-27.2768|-49.3889
3153400|presidente olegario|MG|-18.4096|-46.4165
3541406|presidente prudente|SP|-22.1207|-51.3925
2109270|presidente sarney|MA|-2.58799|-45.3595
2925758|presidente tancredo neves|BA|-13.4471|-39.4203
2109304|presidente vargas|MA|-3.40787|-44.0234
3541505|presidente venceslau|SP|-21.8732|-51.8447
2611408|primavera|PE|-8.32999|-35.3544
1506104|primavera|PA|-0.945439|-47.1253
1101476|primavera de rondonia|RO|-11.8295|-61.3153
5107040|primavera do leste|MT|-15.544|-54.2811
2109403|primeira cruz|MA|-2.50568|-43.4232
4120507|primeiro de maio|PR|-22.8517|-51.0293
4214151|princesa|SC|-26.4441|-53.5994
2512309|princesa isabel|PB|-7.73175|-37.9886
5218391|professor jamil|GO|-17.2497|-49.244
4315156|progresso|RS|-29.2441|-52.3197
3541604|promissao|SP|-21.5356|-49.8599
2805703|propria|SE|-10.2138|-36.8442
4315172|protasio alves|RS|-28.7572|-51.4757
3153608|prudente de morais|MG|-19.4742|-44.1591
4120606|prudentopolis|PR|-25.2111|-50.9754
1718451|pugmil|TO|-10.424|-48.8957
2410405|pureza|RN|-5.46393|-35.5554
4315206|putinga|RS|-29.0045|-52.1569
2512408|puxinana|PB|-7.15479|-35.9543
3541653|quadra|SP|-23.2993|-48.0547
4315305|quarai|RS|-30.384|-56.4483
3153707|quartel geral|MG|-19.2703|-45.5569
4120655|quarto centenario|PR|-24.2775|-53.0759
3541703|quata|SP|-22.2456|-50.6966
4120705|quatigua|PR|-23.5671|-49.916
1506112|quatipuru|PA|-0.899604|-47.0134
3304128|quatis|RJ|-22.4045|-44.2597
4120804|quatro barras|PR|-25.3673|-49.0763
4315313|quatro irmaos|RS|-27.8257|-52.4424
4120853|quatro pontes|PR|-24.5752|-53.9759
2707602|quebrangulo|AL|-9.32001|-36.4692
4120903|quedas do iguacu|PR|-25.4492|-52.9102
2208650|queimada nova|PI|-8.57064|-41.4106
2512507|queimadas|PB|-7.35029|-35.9031
2925808|queimadas|BA|-10.9736|-39.6293
3304144|queimados|RJ|-22.7102|-43.5518
3541802|queiroz|SP|-21.7969|-50.2415
3541901|queluz|SP|-22.5312|-44.7781
3153806|queluzito|MG|-20.7416|-43.8851
5107065|querencia|MT|-12.6093|-52.1821
4121000|querencia do norte|PR|-23.0838|-53.483
4315321|quevedos|RS|-29.3504|-54.0789
2925907|quijingue|BA|-10.7505|-39.2137
4214201|quilombo|SC|-26.7264|-52.724
4121109|quinta do sol|PR|-23.8533|-52.1309
3542008|quintana|SP|-22.0692|-50.307
4315354|quinze de novembro|RS|-28.7466|-53.1011
2611507|quipapa|PE|-8.81175|-36.0137
5218508|quirinopolis|GO|-18.4472|-50.4547
3304151|quissama|RJ|-22.1031|-41.4693
4121208|quitandinha|PR|-25.8734|-49.4973
2311264|quiterianopolis|CE|-5.8425|-40.7002
2512606|quixaba|PB|-7.0224|-37.1458
2611533|quixaba|PE|-7.70734|-37.8446
2925931|quixabeira|BA|-11.4031|-40.12
2311306|quixada|CE|-4.9663|-39.0155
2311355|quixelo|CE|-6.24637|-39.2011
2311405|quixeramobim|CE|-5.19067|-39.2889
2311504|quixere|CE|-5.07148|-37.9802
2410504|rafael fernandes|RN|-6.18987|-38.2211
2410603|rafael godeiro|RN|-6.07244|-37.716
2925956|rafael jambeiro|BA|-12.4053|-39.5007
3542107|rafard|SP|-23.0105|-47.5318
4121257|ramilandia|PR|-25.1195|-54.023
3542206|rancharia|SP|-22.2269|-50.893
4121307|rancho alegre|PR|-23.0676|-50.9145
4121356|rancho alegre d oeste|PR|-24.3065|-52.9552
4214300|rancho queimado|SC|-27.6727|-49.0191
2109452|raposa|MA|-2.4254|-44.0973
3153905|raposos|MG|-19.9636|-43.8079
3154002|raul soares|MG|-20.1061|-42.4502
4121406|realeza|PR|-25.7711|-53.526
4121505|reboucas|PR|-25.6232|-50.6877
2611606|recife|PE|-8.04666|-34.8771
3154101|recreio|MG|-21.5289|-42.4676
1718501|recursolandia|TO|-8.7227|-47.2421
1506138|redencao|PA|-8.02529|-50.0317
2311603|redencao|CE|-4.21587|-38.7277
3542305|redencao da serra|SP|-23.2638|-45.5422
2208700|redencao do gurgueia|PI|-9.47937|-44.5811
4315404|redentora|RS|-27.664|-53.6407
3154150|reduto|MG|-20.2401|-41.9848
2208809|regeneracao|PI|-6.23115|-42.6842
3542404|regente feijo|SP|-22.2181|-51.3055
3542503|reginopolis|SP|-21.8914|-49.2268
3542602|registro|SP|-24.4979|-47.8449
4315453|relvado|RS|-29.1164|-52.0778
2926004|remanso|BA|-9.61944|-42.0848
2512705|remigio|PB|-6.94992|-35.8011
4121604|renascenca|PR|-26.1588|-52.9703
2311702|reriutaba|CE|-4.14191|-40.5759
3304201|resende|RJ|-22.4705|-44.4509
3154200|resende costa|MG|-20.9171|-44.2407
4121703|reserva|PR|-24.6492|-50.8466
5107156|reserva do cabacal|MT|-15.0743|-58.4585
4121752|reserva do iguacu|PR|-25.8319|-52.0272
3154309|resplendor|MG|-19.3194|-41.2462
3154408|ressaquinha|MG|-21.0642|-43.7598
3542701|restinga|SP|-20.6056|-47.4833
4315503|restinga seca|RS|-29.8188|-53.3807
2926103|retirolandia|BA|-11.4832|-39.4234
2512747|riachao|PB|-6.54269|-35.661
2109502|riachao|MA|-7.35819|-46.6225
2926202|riachao das neves|BA|-11.7508|-44.9143
2512754|riachao do bacamarte|PB|-7.25347|-35.6693
2805802|riachao do dantas|SE|-11.0729|-37.731
2926301|riachao do jacuipe|BA|-11.8067|-39.3818
2512762|riachao do poco|PB|-7.14173|-35.2914
1718550|riachinho|TO|-6.44005|-48.1371
3154457|riachinho|MG|-16.2258|-45.9888
2410702|riacho da cruz|RN|-5.92654|-37.949
2611705|riacho das almas|PE|-8.13742|-35.8648
2410801|riacho de santana|RN|-6.25139|-38.3116
2926400|riacho de santana|BA|-13.6059|-42.9397
2512788|riacho de santo antonio|PB|-7.68023|-36.157
2512804|riacho dos cavalos|PB|-6.44067|-37.6483
3154507|riacho dos machados|MG|-16.0091|-43.0488
2208858|riacho frio|PI|-10.1244|-44.9503
2410900|riachuelo|RN|-5.82156|-35.8215
2805901|riachuelo|SE|-10.735|-37.1966
5218607|rialma|GO|-15.3145|-49.5814
5218706|rianapolis|GO|-15.4456|-49.5114
2109551|ribamar fiquene|MA|-5.93067|-47.3888
5007109|ribas do rio pardo|MS|-20.4445|-53.7588
3542800|ribeira|SP|-24.6517|-49.0044
2926509|ribeira do amparo|BA|-11.0421|-38.4242
2208874|ribeira do piaui|PI|-7.69028|-42.7128
2926608|ribeira do pombal|BA|-10.8373|-38.5382
2611804|ribeirao|PE|-8.50957|-35.3698
3542909|ribeirao bonito|SP|-22.0685|-48.182
3543006|ribeirao branco|SP|-24.2206|-48.7635
5107180|ribeirao cascalheira|MT|-12.9367|-51.8244
4121802|ribeirao claro|PR|-23.1941|-49.7597
3543105|ribeirao corrente|SP|-20.4579|-47.5904
3154606|ribeirao das neves|MG|-19.7621|-44.0844
2926657|ribeirao do largo|BA|-15.4508|-40.7441
4121901|ribeirao do pinhal|PR|-23.4091|-50.3601
3543204|ribeirao do sul|SP|-22.789|-49.933
3543238|ribeirao dos indios|SP|-21.8382|-51.6103
3543253|ribeirao grande|SP|-24.1011|-48.3679
3543303|ribeirao pires|SP|-23.7067|-46.4058
3543402|ribeirao preto|SP|-21.1699|-47.8099
3154705|ribeirao vermelho|MG|-21.1879|-45.0637
5107198|ribeiraozinho|MT|-16.4856|-52.6924
2208908|ribeiro goncalves|PI|-7.55651|-45.2447
2806008|ribeiropolis|SE|-10.5357|-37.438
3543600|rifaina|SP|-20.0803|-47.4291
3543709|rincao|SP|-21.5894|-48.0728
3543808|rinopolis|SP|-21.7284|-50.7239
3154804|rio acima|MG|-20.0876|-43.7878
4122008|rio azul|PR|-25.7306|-50.7985
3204351|rio bananal|ES|-19.2719|-40.3366
4122107|rio bom|PR|-23.7606|-51.4122
3304300|rio bonito|RJ|-22.7181|-42.6276
4122156|rio bonito do iguacu|PR|-25.4874|-52.5292
5107206|rio branco|MT|-15.2483|-58.1259
1200401|rio branco|AC|-9.97499|-67.8243
4122172|rio branco do ivai|PR|-24.3244|-51.3187
4122206|rio branco do sul|PR|-25.1892|-49.3115
5007208|rio brilhante|MS|-21.8033|-54.5427
3154903|rio casca|MG|-20.2285|-42.6462
3304409|rio claro|RJ|-22.72|-44.1419
3543907|rio claro|SP|-22.3984|-47.5546
1100262|rio crespo|RO|-9.69965|-62.9011
1718659|rio da conceicao|TO|-11.3949|-46.8847
4214409|rio das antas|SC|-26.8946|-51.0674
3304508|rio das flores|RJ|-22.1692|-43.5856
3304524|rio das ostras|RJ|-22.5174|-41.9475
3544004|rio das pedras|SP|-22.8417|-47.6047
2926707|rio de contas|BA|-13.5852|-41.8048
3304557|rio de janeiro|RJ|-22.9129|-43.2003
2926806|rio do antonio|BA|-14.4071|-42.0721
4214508|rio do campo|SC|-26.9452|-50.136
2408953|rio do fogo|RN|-5.2765|-35.3794
4214607|rio do oeste|SC|-27.1952|-49.7989
2926905|rio do pires|BA|-13.1185|-42.2902
3155108|rio do prado|MG|-16.6056|-40.5714
4214805|rio do sul|SC|-27.2156|-49.643
3155009|rio doce|MG|-20.2412|-42.8995
1718709|rio dos bois|TO|-9.34425|-48.5245
4214706|rio dos cedros|SC|-26.7398|-49.2718
4315552|rio dos indios|RS|-27.2973|-52.8417
3155207|rio espera|MG|-20.855|-43.4721
2611903|rio formoso|PE|-8.6592|-35.1532
4214904|rio fortuna|SC|-28.1244|-49.1068
4315602|rio grande|RS|-32.0349|-52.1071
3544103|rio grande da serra|SP|-23.7437|-46.3971
2209005|rio grande do piaui|PI|-7.78029|-43.1369
2707701|rio largo|AL|-9.47783|-35.8394
3155306|rio manso|MG|-20.2666|-44.3069
1506161|rio maria|PA|-7.31236|-50.0379
4215000|rio negrinho|SC|-26.2591|-49.5177
5007307|rio negro|MS|-19.447|-54.9859
4122305|rio negro|PR|-26.095|-49.7982
3155405|rio novo|MG|-21.4649|-43.1168
3204401|rio novo do sul|ES|-20.8556|-40.9388
3155504|rio paranaiba|MG|-19.1861|-46.2455
4315701|rio pardo|RS|-29.988|-52.3711
3155603|rio pardo de minas|MG|-15.616|-42.5405
3155702|rio piracicaba|MG|-19.9284|-43.1829
3155801|rio pomba|MG|-21.2712|-43.1696
3155900|rio preto|MG|-22.0861|-43.8293
1303569|rio preto da eva|AM|-2.7045|-59.6858
5218789|rio quente|GO|-17.774|-48.7725
2927002|rio real|BA|-11.4814|-37.9332
4215059|rio rufino|SC|-27.8592|-49.7754
1718758|rio sono|TO|-9.35002|-47.888
2512903|rio tinto|PB|-6.80383|-35.0776
5218805|rio verde|GO|-17.7923|-50.9192
5007406|rio verde de mato grosso|MS|-18.9249|-54.8434
3156007|rio vermelho|MG|-18.2922|-43.0018
3544202|riolandia|SP|-19.9868|-49.6836
4315750|riozinho|RS|-29.639|-50.4488
4215075|riqueza|SC|-27.0653|-53.3265
3156106|ritapolis|MG|-21.0276|-44.3204
3543501|riversul|SP|-23.829|-49.429
4315800|roca sales|RS|-29.2884|-51.8658
5007505|rochedo|MS|-19.9565|-54.8848
3156205|rochedo de minas|MG|-21.6284|-43.0165
4215109|rodeio|SC|-26.9243|-49.3649
4315909|rodeio bonito|RS|-27.4742|-53.1706
3156304|rodeiro|MG|-21.2035|-42.8586
2927101|rodelas|BA|-8.85021|-38.78
2411007|rodolfo fernandes|RN|-5.78393|-38.0579
1200427|rodrigues alves|AC|-7.73864|-72.661
4315958|rolador|RS|-28.2566|-54.8186
4122404|rolandia|PR|-23.3101|-51.3659
4316006|rolante|RS|-29.6462|-50.5819
1100288|rolim de moura|RO|-11.7271|-61.7714
3156403|romaria|MG|-18.8838|-47.5782
4215208|romelandia|SC|-26.6809|-53.3172
4122503|roncador|PR|-24.5958|-52.2716
4316105|ronda alta|RS|-27.7758|-52.8056
4316204|rondinha|RS|-27.8315|-52.9081
5107578|rondolandia|MT|-10.8376|-61.4697
4122602|rondon|PR|-23.412|-52.7659
1506187|rondon do para|PA|-4.77793|-48.067
5107602|rondonopolis|MT|-16.4673|-54.6372
4316303|roque gonzales|RS|-28.1297|-55.0266
1400472|rorainopolis|RR|0.939956|-60.4389
3544251|rosana|SP|-22.5782|-53.0603
2109601|rosario|MA|-2.93444|-44.2531
3156452|rosario da limeira|MG|-20.9812|-42.5112
2806107|rosario do catete|SE|-10.6904|-37.0357
4122651|rosario do ivai|PR|-24.2682|-51.272
4316402|rosario do sul|RS|-30.2515|-54.9221
5107701|rosario oeste|MT|-14.8259|-56.4236
3544301|roseira|SP|-22.8938|-45.307
2707800|roteiro|AL|-9.83503|-35.9782
3156502|rubelita|MG|-16.4053|-42.261
3544400|rubiacea|SP|-21.3006|-50.7296
5218904|rubiataba|GO|-15.1617|-49.8048
3156601|rubim|MG|-16.3775|-40.5397
3544509|rubineia|SP|-20.1759|-51.007
1506195|ruropolis|PA|-4.10028|-54.9092
2311801|russas|CE|-4.92673|-37.9721
2411106|ruy barbosa|RN|-5.88745|-35.933
2927200|ruy barbosa|BA|-12.2816|-40.4931
3156700|sabara|MG|-19.884|-43.8263
4122701|sabaudia|PR|-23.3155|-51.555
3544608|sabino|SP|-21.4593|-49.5755
3156809|sabinopolis|MG|-18.6653|-43.0752
2311900|saboeiro|CE|-6.5346|-39.9017
3156908|sacramento|MG|-19.8622|-47.4508
4316428|sagrada familia|RS|-27.7085|-53.1351
3544707|sagres|SP|-21.8823|-50.9594
2612000|saire|PE|-8.32864|-35.6967
4316436|saldanha marinho|RS|-28.3941|-53.097
3544806|sales|SP|-21.3427|-49.4897
3544905|sales oliveira|SP|-20.7696|-47.8369
3545001|salesopolis|SP|-23.5288|-45.8465
4215307|salete|SC|-26.9798|-49.9988
2513000|salgadinho|PB|-7.10098|-36.8458
2612109|salgadinho|PE|-7.9269|-35.6503
2806206|salgado|SE|-11.0288|-37.4804
2513109|salgado de sao felix|PB|-7.35337|-35.4305
4122800|salgado filho|PR|-26.1777|-53.3631
2612208|salgueiro|PE|-8.07373|-39.1247
3157005|salinas|MG|-16.1753|-42.2964
2927309|salinas da margarida|BA|-12.873|-38.7562
1506203|salinopolis|PA|-0.630815|-47.3465
2311959|salitre|CE|-7.28398|-40.45
3545100|salmourao|SP|-21.6267|-50.8614
2612307|saloa|PE|-8.9723|-36.691
4215356|saltinho|SC|-26.6049|-53.0578
3545159|saltinho|SP|-22.8442|-47.6754
3545209|salto|SP|-23.1996|-47.2931
3157104|salto da divisa|MG|-16.0063|-39.9391
3545308|salto de pirapora|SP|-23.6474|-47.5743
5107750|salto do ceu|MT|-15.1303|-58.1317
4122909|salto do itarare|PR|-23.6074|-49.6354
4316451|salto do jacui|RS|-29.0951|-53.2133
4123006|salto do lontra|PR|-25.7813|-53.3135
3545407|salto grande|SP|-22.8894|-49.9831
4215406|salto veloso|SC|-26.903|-51.4043
2927408|salvador|BA|-12.9718|-38.5011
4316477|salvador das missoes|RS|-28.1233|-54.8373
4316501|salvador do sul|RS|-29.4386|-51.5077
1506302|salvaterra|PA|-0.758444|-48.5139
2109700|sambaiba|MA|-7.13447|-45.3515
1718808|sampaio|TO|-5.35423|-47.8782
4316600|sananduva|RS|-27.947|-51.8079
5219001|sanclerlandia|GO|-16.197|-50.3124
1718840|sandolandia|TO|-12.538|-49.9242
3545506|sandovalina|SP|-22.4551|-51.7648
4215455|sangao|SC|-28.6326|-49.1322
2612406|sanharo|PE|-8.36097|-36.5696
4317103|sant ana do livramento|RS|-30.8773|-55.5392
3545605|santa adelia|SP|-21.2427|-48.8063
3545704|santa albertina|SP|-20.0311|-50.7297
4123105|santa amelia|PR|-23.2654|-50.4288
2927507|santa barbara|BA|-11.9515|-38.9681
3157203|santa barbara|MG|-19.9604|-43.4101
3545803|santa barbara d oeste|SP|-22.7553|-47.4143
5219100|santa barbara de goias|GO|-16.5714|-49.6954
3157252|santa barbara do leste|MG|-19.9753|-42.1457
3157278|santa barbara do monte verde|MG|-21.9592|-43.7027
1506351|santa barbara do para|PA|-1.19219|-48.238
4316709|santa barbara do sul|RS|-28.3653|-53.251
3157302|santa barbara do tugurio|MG|-21.2431|-43.5607
3546009|santa branca|SP|-23.3933|-45.8875
2927606|santa brigida|BA|-9.73227|-38.1209
5107248|santa carmem|MT|-11.9125|-55.2263
4215505|santa cecilia|SC|-26.9592|-50.4252
2513158|santa cecilia|PB|-7.7389|-35.8764
4123204|santa cecilia do pavao|PR|-23.5201|-50.7835
4316733|santa cecilia do sul|RS|-28.1609|-51.9279
3546108|santa clara d oeste|SP|-20.09|-50.9491
4316758|santa clara do sul|RS|-29.4747|-52.0843
2411205|santa cruz|RN|-6.22475|-36.0193
2513208|santa cruz|PB|-6.5237|-38.0617
2612455|santa cruz|PE|-8.24153|-40.3434
2927705|santa cruz cabralia|BA|-16.2825|-39.0295
2612471|santa cruz da baixa verde|PE|-7.81339|-38.1476
3546207|santa cruz da conceicao|SP|-22.1405|-47.4512
3546256|santa cruz da esperanca|SP|-21.2951|-47.4304
2927804|santa cruz da vitoria|BA|-14.964|-39.8115
3546306|santa cruz das palmeiras|SP|-21.8235|-47.248
5219209|santa cruz de goias|GO|-17.3155|-48.4809
3157336|santa cruz de minas|MG|-21.1241|-44.2202
4123303|santa cruz de monte castelo|PR|-22.9582|-53.2949
3157377|santa cruz de salinas|MG|-16.0967|-41.7418
1506401|santa cruz do arari|PA|-0.661019|-49.1771
2612505|santa cruz do capibaribe|PE|-7.94802|-36.2061
3157401|santa cruz do escalvado|MG|-20.2372|-42.8169
2209104|santa cruz do piaui|PI|-7.1785|-41.7609
3546405|santa cruz do rio pardo|SP|-22.8988|-49.6354
4316808|santa cruz do sul|RS|-29.722|-52.4343
5107743|santa cruz do xingu|MT|-10.1532|-52.3953
2209153|santa cruz dos milagres|PI|-5.80581|-41.9506
3157500|santa efigenia de minas|MG|-18.8235|-42.4388
3546504|santa ernestina|SP|-21.4618|-48.3953
4123402|santa fe|PR|-23.04|-51.808
5219258|santa fe de goias|GO|-15.7664|-51.1037
3157609|santa fe de minas|MG|-16.6859|-45.4102
1718865|santa fe do araguaia|TO|-7.15803|-48.7165
3546603|santa fe do sul|SP|-20.2083|-50.932
2209203|santa filomena|PI|-9.11228|-45.9116
2612554|santa filomena|PE|-8.16688|-40.6079
2109759|santa filomena do maranhao|MA|-5.49671|-44.5638
3546702|santa gertrudes|SP|-22.4572|-47.5272
4123501|santa helena|PR|-24.8585|-54.336
4215554|santa helena|SC|-26.937|-53.6214
2109809|santa helena|MA|-2.24426|-45.29
2513307|santa helena|PB|-6.7176|-38.6427
5219308|santa helena de goias|GO|-17.8115|-50.5977
3157658|santa helena de minas|MG|-16.9707|-40.6727
2927903|santa ines|BA|-13.2793|-39.814
4123600|santa ines|PR|-22.6376|-51.9024
2513356|santa ines|PB|-7.621|-38.554
2109908|santa ines|MA|-3.65112|-45.3774
3546801|santa isabel|SP|-23.3172|-46.2237
5219357|santa isabel|GO|-15.2958|-49.4259
4123709|santa isabel do ivai|PR|-23.0025|-53.1989
1303601|santa isabel do rio negro|AM|-0.410824|-65.0092
4123808|santa izabel do oeste|PR|-25.8217|-53.4801
1506500|santa izabel do para|PA|-1.29686|-48.1606
3157708|santa juliana|MG|-19.3108|-47.5322
3204500|santa leopoldina|ES|-20.0999|-40.527
3546900|santa lucia|SP|-21.685|-48.0885
4123824|santa lucia|PR|-25.4104|-53.5638
2209302|santa luz|PI|-8.9488|-44.1296
2110005|santa luzia|MA|-4.06873|-45.69
2928059|santa luzia|BA|-15.4342|-39.3287
3157807|santa luzia|MG|-19.7548|-43.8497
2513406|santa luzia|PB|-6.86092|-36.9178
1100296|santa luzia d oeste|RO|-11.9074|-61.7777
2806305|santa luzia do itanhy|SE|-11.3536|-37.4586
2707909|santa luzia do norte|AL|-9.6037|-35.8232
1506559|santa luzia do para|PA|-1.52147|-46.9008
2110039|santa luzia do parua|MA|-2.51123|-45.7801
3157906|santa margarida|MG|-20.3839|-42.2519
4316972|santa margarida do sul|RS|-30.3393|-54.0817
4316907|santa maria|RS|-29.6868|-53.8149
2409332|santa maria|RN|-5.83802|-35.6914
2612604|santa maria da boa vista|PE|-8.79766|-39.8241
3547007|santa maria da serra|SP|-22.5661|-48.1593
2928109|santa maria da vitoria|BA|-13.3859|-44.2011
1506583|santa maria das barreiras|PA|-8.85784|-49.7215
3158003|santa maria de itabira|MG|-19.4431|-43.1064
3204559|santa maria de jetiba|ES|-20.0253|-40.7439
2612703|santa maria do cambuca|PE|-7.83676|-35.8941
4316956|santa maria do herval|RS|-29.4902|-50.9919
4123857|santa maria do oeste|PR|-24.9377|-51.8696
1506609|santa maria do para|PA|-1.35392|-47.5712
3158102|santa maria do salto|MG|-16.2479|-40.1512
3158201|santa maria do suacui|MG|-18.1896|-42.4139
1718881|santa maria do tocantins|TO|-8.8046|-47.7887
3304607|santa maria madalena|RJ|-21.9547|-42.0098
4123907|santa mariana|PR|-23.1465|-50.5167
3547106|santa mercedes|SP|-21.3495|-51.7564
4123956|santa monica|PR|-23.108|-53.1103
2312205|santa quiteria|CE|-4.32608|-40.1523
2110104|santa quiteria do maranhao|MA|-3.49308|-42.5688
2110203|santa rita|MA|-3.14241|-44.3211
2513703|santa rita|PB|-7.11724|-34.9753
3547403|santa rita d oeste|SP|-20.1414|-50.8358
3159209|santa rita de caldas|MG|-22.0292|-46.3385
2928406|santa rita de cassia|BA|-11.0063|-44.5255
3159407|santa rita de ibitipoca|MG|-21.5658|-43.9163
3159308|santa rita de jacutinga|MG|-22.1474|-44.0977
3159357|santa rita de minas|MG|-19.876|-42.1363
5219407|santa rita do araguaia|GO|-17.3269|-53.2012
3159506|santa rita do itueto|MG|-19.3576|-41.3821
5219456|santa rita do novo destino|GO|-15.1351|-49.1203
5007554|santa rita do pardo|MS|-21.3016|-52.8333
3547502|santa rita do passa quatro|SP|-21.7083|-47.478
3159605|santa rita do sapucai|MG|-22.2461|-45.7034
1718899|santa rita do tocantins|TO|-10.8617|-48.9161
5107768|santa rita do trivelato|MT|-13.8146|-55.2706
4317202|santa rosa|RS|-27.8702|-54.4796
3159704|santa rosa da serra|MG|-19.5186|-45.9611
5219506|santa rosa de goias|GO|-16.084|-49.4953
4215604|santa rosa de lima|SC|-28.0331|-49.133
2806503|santa rosa de lima|SE|-10.6434|-37.1931
3547601|santa rosa de viterbo|SP|-21.4776|-47.3622
2209377|santa rosa do piaui|PI|-6.79581|-42.2814
1200435|santa rosa do purus|AC|-9.44652|-70.4902
4215653|santa rosa do sul|SC|-29.1313|-49.7109
1718907|santa rosa do tocantins|TO|-11.4474|-48.1216
3547650|santa salete|SP|-20.2429|-50.6887
3204609|santa teresa|ES|-19.9363|-40.5979
2928505|santa teresinha|BA|-12.7697|-39.5215
2513802|santa teresinha|PB|-7.07964|-37.4435
4317251|santa tereza|RS|-29.1655|-51.7351
5219605|santa tereza de goias|GO|-13.7138|-49.0144
4124020|santa tereza do oeste|PR|-25.0543|-53.6274
1719004|santa tereza do tocantins|TO|-10.2746|-47.8033
4215679|santa terezinha|SC|-26.7813|-50.009
5107776|santa terezinha|MT|-10.4704|-50.514
2612802|santa terezinha|PE|-7.37696|-37.4787
5219704|santa terezinha de goias|GO|-14.4326|-49.7091
4124053|santa terezinha de itaipu|PR|-25.4391|-54.402
4215687|santa terezinha do progresso|SC|-26.624|-53.1997
1720002|santa terezinha do tocantins|TO|-6.44438|-47.6684
3159803|santa vitoria|MG|-18.8414|-50.1208
4317301|santa vitoria do palmar|RS|-33.525|-53.3717
2928000|santaluz|BA|-11.2508|-39.375
2928208|santana|BA|-12.9792|-44.0506
1600600|santana|AP|-0.045434|-51.1729
4317004|santana da boa vista|RS|-30.8697|-53.11
3547205|santana da ponte pensa|SP|-20.2523|-50.8014
3158300|santana da vargem|MG|-21.2449|-45.5005
3158409|santana de cataguases|MG|-21.2893|-42.5524
2513505|santana de mangueira|PB|-7.54705|-38.3236
3547304|santana de parnaiba|SP|-23.4439|-46.9178
3158508|santana de pirapama|MG|-18.9962|-44.0409
2312007|santana do acarau|CE|-3.46144|-40.2118
1506708|santana do araguaia|PA|-9.3281|-50.35
2312106|santana do cariri|CE|-7.17613|-39.7302
3158607|santana do deserto|MG|-21.9512|-43.1583
3158706|santana do garambeu|MG|-21.5983|-44.105
2708006|santana do ipanema|AL|-9.36999|-37.248
4124004|santana do itarare|PR|-23.7587|-49.6293
3158805|santana do jacare|MG|-20.9007|-45.1285
3158904|santana do manhuacu|MG|-20.1031|-41.9278
2110237|santana do maranhao|MA|-3.109|-42.4064
2411403|santana do matos|RN|-5.94605|-36.6578
2708105|santana do mundau|AL|-9.17141|-36.2176
3158953|santana do paraiso|MG|-19.3661|-42.5446
2209351|santana do piaui|PI|-6.94696|-41.5178
3159001|santana do riacho|MG|-19.1662|-43.722
2806404|santana do sao francisco|SE|-10.2922|-36.6105
2411429|santana do serido|RN|-6.76643|-36.7312
2513604|santana dos garrotes|PB|-7.38162|-37.9819
3159100|santana dos montes|MG|-20.7868|-43.6949
2928307|santanopolis|BA|-12.0311|-38.8694
1506807|santarem|PA|-2.43849|-54.6996
1506906|santarem novo|PA|-0.93097|-47.3855
4317400|santiago|RS|-29.1897|-54.8666
4215695|santiago do sul|SC|-26.6388|-52.6799
5107263|santo afonso|MT|-14.4945|-57.0091
2928604|santo amaro|BA|-12.5472|-38.7137
4215703|santo amaro da imperatriz|SC|-27.6852|-48.7813
2806602|santo amaro das brotas|SE|-10.7892|-37.0564
2110278|santo amaro do maranhao|MA|-2.50068|-43.238
3547700|santo anastacio|SP|-21.9747|-51.6527
3547809|santo andre|SP|-23.6737|-46.5432
2513851|santo andre|PB|-7.22016|-36.6213
4317509|santo angelo|RS|-28.3001|-54.2668
2411502|santo antonio|RN|-6.31195|-35.4739
3547908|santo antonio da alegria|SP|-21.0864|-47.1464
5219712|santo antonio da barra|GO|-17.5585|-50.6345
4317608|santo antonio da patrulha|RS|-29.8268|-50.5175
4124103|santo antonio da platina|PR|-23.2959|-50.0815
4317707|santo antonio das missoes|RS|-28.514|-55.2251
5219738|santo antonio de goias|GO|-16.4815|-49.3096
2928703|santo antonio de jesus|BA|-12.9614|-39.2584
2209401|santo antonio de lisboa|PI|-6.98676|-41.2252
3304706|santo antonio de padua|RJ|-21.541|-42.1832
3548005|santo antonio de posse|SP|-22.6029|-46.9192
3159902|santo antonio do amparo|MG|-20.943|-44.9176
3548054|santo antonio do aracangua|SP|-20.9331|-50.498
3160009|santo antonio do aventureiro|MG|-21.7606|-42.8115
4124202|santo antonio do caiua|PR|-22.7351|-52.344
5219753|santo antonio do descoberto|GO|-15.9412|-48.2578
3160108|santo antonio do grama|MG|-20.3185|-42.6047
1303700|santo antonio do ica|AM|-3.09544|-67.9463
3160207|santo antonio do itambe|MG|-18.4609|-43.3006
3160306|santo antonio do jacinto|MG|-16.5332|-40.1817
3548104|santo antonio do jardim|SP|-22.1121|-46.6845
5107792|santo antonio do leste|MT|-14.805|-53.6075
5107800|santo antonio do leverger|MT|-15.8632|-56.0788
3160405|santo antonio do monte|MG|-20.085|-45.2947
4317558|santo antonio do palma|RS|-28.4956|-52.0267
4124301|santo antonio do paraiso|PR|-23.4969|-50.6455
3548203|santo antonio do pinhal|SP|-22.827|-45.663
4317756|santo antonio do planalto|RS|-28.403|-52.6992
3160454|santo antonio do retiro|MG|-15.3393|-42.6171
3160504|santo antonio do rio abaixo|MG|-19.2374|-43.2604
4124400|santo antonio do sudoeste|PR|-26.0737|-53.7251
1507003|santo antonio do taua|PA|-1.1522|-48.1314
2110302|santo antonio dos lopes|MA|-4.86613|-44.3653
2209450|santo antonio dos milagres|PI|-6.04647|-42.7123
4317806|santo augusto|RS|-27.8526|-53.7776
4317905|santo cristo|RS|-27.8263|-54.662
2928802|santo estevao|BA|-12.428|-39.2505
3548302|santo expedito|SP|-21.8467|-51.3929
4317954|santo expedito do sul|RS|-27.9074|-51.6434
3160603|santo hipolito|MG|-18.2968|-44.2229
4124509|santo inacio|PR|-22.6957|-51.7969
2209500|santo inacio do piaui|PI|-7.42072|-41.9063
3548401|santopolis do aguapei|SP|-21.6376|-50.5044
3548500|santos|SP|-23.9535|-46.335
3160702|santos dumont|MG|-21.4634|-43.5499
2312304|sao benedito|CE|-4.04713|-40.8596
2110401|sao benedito do rio preto|MA|-3.33515|-43.5287
2612901|sao benedito do sul|PE|-8.8166|-35.9453
2513927|sao bentinho|PB|-6.88596|-37.7243
2513901|sao bento|PB|-6.48529|-37.4488
2110500|sao bento|MA|-2.69781|-44.8289
3160801|sao bento abade|MG|-21.5839|-45.0699
2411601|sao bento do norte|RN|-5.09259|-35.9587
3548609|sao bento do sapucai|SP|-22.6837|-45.7287
4215802|sao bento do sul|SC|-26.2495|-49.3831
1720101|sao bento do tocantins|TO|-6.0258|-47.9012
2411700|sao bento do trairi|RN|-6.33798|-36.0863
2613008|sao bento do una|PE|-8.52637|-36.4465
4215752|sao bernardino|SC|-26.4739|-52.9687
2110609|sao bernardo|MA|-3.37223|-42.4191
3548708|sao bernardo do campo|SP|-23.6914|-46.5646
4215901|sao bonifacio|SC|-27.9009|-48.9326
4318002|sao borja|RS|-28.6578|-56.0036
2708204|sao bras|AL|-10.1141|-36.8522
3160900|sao bras do suacui|MG|-20.6242|-43.9515
2209559|sao braz do piaui|PI|-9.05797|-43.0076
2613107|sao caetano|PE|-8.33763|-36.2869
1507102|sao caetano de odivelas|PA|-0.747293|-48.0246
3548807|sao caetano do sul|SP|-23.6229|-46.5548
3548906|sao carlos|SP|-22.0174|-47.886
4216008|sao carlos|SC|-27.0798|-53.0037
4124608|sao carlos do ivai|PR|-23.3158|-52.4761
2806701|sao cristovao|SE|-11.0084|-37.2044
4216057|sao cristovao do sul|SC|-27.2666|-50.4388
2928901|sao desiderio|BA|-12.3572|-44.9769
2928950|sao domingos|BA|-11.4649|-39.5268
4216107|sao domingos|SC|-26.5548|-52.5313
2513968|sao domingos|PB|-6.80313|-37.9488
2806800|sao domingos|SE|-10.7916|-37.5685
5219803|sao domingos|GO|-13.621|-46.7415
3160959|sao domingos das dores|MG|-19.5246|-42.0106
1507151|sao domingos do araguaia|PA|-5.53732|-48.7366
2110658|sao domingos do azeitao|MA|-6.81471|-44.6509
1507201|sao domingos do capim|PA|-1.68768|-47.7665
2513943|sao domingos do cariri|PB|-7.63273|-36.4374
2110708|sao domingos do maranhao|MA|-5.58095|-44.3822
3204658|sao domingos do norte|ES|-19.1452|-40.6281
3161007|sao domingos do prata|MG|-19.8678|-42.971
4318051|sao domingos do sul|RS|-28.5312|-51.886
2929107|sao felipe|BA|-12.8394|-39.0893
1101484|sao felipe d oeste|RO|-11.9023|-61.5026
2929008|sao felix|BA|-12.6104|-38.9727
2110807|sao felix de balsas|MA|-7.07535|-44.8092
3161056|sao felix de minas|MG|-18.5959|-41.4889
5107859|sao felix do araguaia|MT|-11.615|-50.6706
2929057|sao felix do coribe|BA|-13.4019|-44.1837
2209609|sao felix do piaui|PI|-5.93485|-42.1172
1720150|sao felix do tocantins|TO|-10.1615|-46.6618
1507300|sao felix do xingu|PA|-6.64254|-51.9904
2411809|sao fernando|RN|-6.37975|-37.1864
3304805|sao fidelis|RJ|-21.6551|-41.756
3549003|sao francisco|SP|-20.3623|-50.6952
2513984|sao francisco|PB|-6.60773|-38.0968
2806909|sao francisco|SE|-10.3442|-36.8869
3161106|sao francisco|MG|-15.9514|-44.8593
4318101|sao francisco de assis|RS|-29.5547|-55.1253
2209658|sao francisco de assis do piaui|PI|-8.23599|-41.6873
5219902|sao francisco de goias|GO|-15.9256|-49.2605
3304755|sao francisco de itabapoana|RJ|-21.4702|-41.1091
4318200|sao francisco de paula|RS|-29.4404|-50.5828
3161205|sao francisco de paula|MG|-20.7036|-44.9838
3161304|sao francisco de sales|MG|-19.8611|-49.7727
2110856|sao francisco do brejao|MA|-5.12584|-47.389
2929206|sao francisco do conde|BA|-12.6183|-38.6786
3161403|sao francisco do gloria|MG|-20.7923|-42.2673
1101492|sao francisco do guapore|RO|-12.052|-63.568
2110906|sao francisco do maranhao|MA|-6.25159|-42.8668
2411908|sao francisco do oeste|RN|-5.97472|-38.1519
1507409|sao francisco do para|PA|-1.16963|-47.7917
2209708|sao francisco do piaui|PI|-7.2463|-42.541
4216206|sao francisco do sul|SC|-26.2579|-48.6344
4318309|sao gabriel|RS|-30.3337|-54.3217
2929255|sao gabriel|BA|-11.2175|-41.8843
1303809|sao gabriel da cachoeira|AM|-0.11909|-67.084
3204708|sao gabriel da palha|ES|-19.0182|-40.5365
5007695|sao gabriel do oeste|MS|-19.3889|-54.5507
3161502|sao geraldo|MG|-20.9252|-42.8364
3161601|sao geraldo da piedade|MG|-18.8411|-42.2867
1507458|sao geraldo do araguaia|PA|-6.39471|-48.5592
3161650|sao geraldo do baixio|MG|-18.9097|-41.363
3304904|sao goncalo|RJ|-22.8268|-43.0634
3161700|sao goncalo do abaete|MG|-18.3315|-45.8265
2412005|sao goncalo do amarante|RN|-5.79068|-35.3257
2312403|sao goncalo do amarante|CE|-3.60515|-38.9726
2209757|sao goncalo do gurgueia|PI|-10.0319|-45.3092
3161809|sao goncalo do para|MG|-19.9822|-44.8593
2209807|sao goncalo do piaui|PI|-5.99393|-42.7095
3161908|sao goncalo do rio abaixo|MG|-19.8221|-43.366
3125507|sao goncalo do rio preto|MG|-18.0025|-43.3854
3162005|sao goncalo do sapucai|MG|-21.8932|-45.5893
2929305|sao goncalo dos campos|BA|-12.4331|-38.9663
3162104|sao gotardo|MG|-19.3087|-46.0465
4318408|sao jeronimo|RS|-29.9716|-51.7251
4124707|sao jeronimo da serra|PR|-23.7218|-50.7475
4124806|sao joao|PR|-25.8214|-52.7252
2613206|sao joao|PE|-8.87576|-36.3653
2111003|sao joao batista|MA|-2.95398|-44.7953
4216305|sao joao batista|SC|-27.2772|-48.8474
3162203|sao joao batista do gloria|MG|-20.635|-46.508
5220009|sao joao d alianca|GO|-14.7048|-47.5228
1400506|sao joao da baliza|RR|0.951659|-59.9133
3305000|sao joao da barra|RJ|-21.638|-41.0446
3549102|sao joao da boa vista|SP|-21.9707|-46.7944
2209856|sao joao da canabrava|PI|-6.81203|-41.3415
2209872|sao joao da fronteira|PI|-3.95497|-41.2569
3162252|sao joao da lagoa|MG|-16.8455|-44.3507
3162302|sao joao da mata|MG|-21.928|-45.9297
5220058|sao joao da parauna|GO|-16.8126|-50.4092
1507466|sao joao da ponta|PA|-0.857885|-47.918
3162401|sao joao da ponte|MG|-15.9271|-44.0096
2209906|sao joao da serra|PI|-5.51081|-41.8923
4318424|sao joao da urtiga|RS|-27.8195|-51.8257
2209955|sao joao da varjota|PI|-6.94082|-41.8889
3549201|sao joao das duas pontes|SP|-20.3879|-50.3792
3162450|sao joao das missoes|MG|-14.8859|-44.0922
3549250|sao joao de iracema|SP|-20.5111|-50.3561
3305109|sao joao de meriti|RJ|-22.8058|-43.3729
1507474|sao joao de pirabas|PA|-0.780222|-47.181
3162500|sao joao del rei|MG|-21.1311|-44.2526
1507508|sao joao do araguaia|PA|-5.36334|-48.7926
2209971|sao joao do arraial|PI|-3.8186|-42.4459
4124905|sao joao do caiua|PR|-22.8535|-52.3411
2514008|sao joao do cariri|PB|-7.38168|-36.5345
2111029|sao joao do caru|MA|-3.5503|-46.2507
4216354|sao joao do itaperiu|SC|-26.6213|-48.7683
4125001|sao joao do ivai|PR|-23.9833|-51.8215
2312502|sao joao do jaguaribe|CE|-5.27516|-38.2694
3162559|sao joao do manhuacu|MG|-20.3933|-42.1533
3162575|sao joao do manteninha|MG|-18.723|-41.1628
4216255|sao joao do oeste|SC|-27.0984|-53.5977
3162609|sao joao do oriente|MG|-19.3384|-42.1575
3162658|sao joao do pacui|MG|-16.5373|-44.5134
3162708|sao joao do paraiso|MG|-15.3168|-42.0213
2111052|sao joao do paraiso|MA|-6.45634|-47.0594
3549300|sao joao do pau d alho|SP|-21.2662|-51.6672
2210003|sao joao do piaui|PI|-8.35466|-42.2559
4318432|sao joao do polesine|RS|-29.6194|-53.4439
2500700|sao joao do rio do peixe|PB|-6.72195|-38.4468
2412104|sao joao do sabugi|RN|-6.71387|-37.2027
2111078|sao joao do soter|MA|-5.10821|-43.8163
4216404|sao joao do sul|SC|-29.2154|-49.8094
2514107|sao joao do tigre|PB|-8.07703|-36.8547
4125100|sao joao do triunfo|PR|-25.683|-50.2949
2111102|sao joao dos patos|MA|-6.4934|-43.7036
3162807|sao joao evangelista|MG|-18.548|-42.7655
3162906|sao joao nepomuceno|MG|-21.5381|-43.0069
4216503|sao joaquim|SC|-28.2887|-49.9457
3549409|sao joaquim da barra|SP|-20.5812|-47.8593
3162922|sao joaquim de bicas|MG|-20.048|-44.2749
2613305|sao joaquim do monte|PE|-8.43196|-35.8035
4318440|sao jorge|RS|-28.4984|-51.7064
4125209|sao jorge d oeste|PR|-25.7085|-52.9204
4125308|sao jorge do ivai|PR|-23.4336|-52.2929
4125357|sao jorge do patrocinio|PR|-23.7647|-53.8823
4216602|sao jose|SC|-27.6136|-48.6366
3162948|sao jose da barra|MG|-20.7178|-46.313
3549508|sao jose da bela vista|SP|-20.5935|-47.6424
4125407|sao jose da boa vista|PR|-23.9122|-49.6577
2613404|sao jose da coroa grande|PE|-8.88937|-35.1515
2514206|sao jose da lagoa tapada|PB|-6.93646|-38.1622
2708303|sao jose da laje|AL|-9.01278|-36.0515
3162955|sao jose da lapa|MG|-19.6971|-43.9586
3163003|sao jose da safira|MG|-18.3243|-42.1431
2708402|sao jose da tapera|AL|-9.55768|-37.3831
3163102|sao jose da varginha|MG|-19.7006|-44.556
2929354|sao jose da vitoria|BA|-15.0787|-39.3437
4318457|sao jose das missoes|RS|-27.7789|-53.1226
4125456|sao jose das palmeiras|PR|-24.8369|-54.0572
2514305|sao jose de caiana|PB|-7.24636|-38.2989
2514404|sao jose de espinharas|PB|-6.83974|-37.3214
2412203|sao jose de mipibu|RN|-6.0773|-35.2417
2514503|sao jose de piranhas|PB|-7.1187|-38.502
2514552|sao jose de princesa|PB|-7.73633|-38.0894
2111201|sao jose de ribamar|MA|-2.54704|-44.0597
3305133|sao jose de uba|RJ|-21.3661|-41.9511
3163201|sao jose do alegre|MG|-22.3243|-45.5258
3549607|sao jose do barreiro|SP|-22.6414|-44.5774
2613503|sao jose do belmonte|PE|-7.85723|-38.7577
2514602|sao jose do bonfim|PB|-7.1607|-37.3036
2514651|sao jose do brejo do cruz|PB|-6.21054|-37.3601
3204807|sao jose do calcado|ES|-21.0274|-41.6636
2412302|sao jose do campestre|RN|-6.31087|-35.7067
4216701|sao jose do cedro|SC|-26.4561|-53.4955
4216800|sao jose do cerrito|SC|-27.6602|-50.5733
2210052|sao jose do divino|PI|-3.81411|-41.8308
3163300|sao jose do divino|MG|-18.4793|-41.3907
2613602|sao jose do egito|PE|-7.46945|-37.274
3163409|sao jose do goiabal|MG|-19.9214|-42.7035
4318465|sao jose do herval|RS|-29.052|-52.295
4318481|sao jose do hortencio|RS|-29.528|-51.245
4318499|sao jose do inhacora|RS|-27.7251|-54.1275
2929370|sao jose do jacuipe|BA|-11.4137|-39.8669
3163508|sao jose do jacuri|MG|-18.281|-42.6729
3163607|sao jose do mantimento|MG|-20.0058|-41.7486
4318507|sao jose do norte|RS|-32.0151|-52.0331
4318606|sao jose do ouro|RS|-27.7707|-51.5966
2210102|sao jose do peixe|PI|-7.48554|-42.5672
2210201|sao jose do piaui|PI|-6.87194|-41.4731
5107297|sao jose do povo|MT|-16.4549|-54.2487
5107305|sao jose do rio claro|MT|-13.4398|-56.7218
3549706|sao jose do rio pardo|SP|-21.5953|-46.8873
3549805|sao jose do rio preto|SP|-20.8113|-49.3758
2514701|sao jose do sabugi|PB|-6.76295|-36.7972
2412401|sao jose do serido|RN|-6.44002|-36.8746
4318614|sao jose do sul|RS|-29.5448|-51.4821
3305158|sao jose do vale do rio preto|RJ|-22.1525|-42.9327
5107354|sao jose do xingu|MT|-10.7982|-52.7486
4318622|sao jose dos ausentes|RS|-28.7476|-50.0677
2111250|sao jose dos basilios|MA|-5.05493|-44.5809
3549904|sao jose dos campos|SP|-23.1896|-45.8841
2514800|sao jose dos cordeiros|PB|-7.38775|-36.8085
4125506|sao jose dos pinhais|PR|-25.5313|-49.2031
5107107|sao jose dos quatro marcos|MT|-15.6276|-58.1772
2514453|sao jose dos ramos|PB|-7.25238|-35.3725
2210300|sao juliao|PI|-7.08391|-40.8246
4318705|sao leopoldo|RS|-29.7545|-51.1498
3163706|sao lourenco|MG|-22.1166|-45.0506
2613701|sao lourenco da mata|PE|-8.00684|-35.0124
3549953|sao lourenco da serra|SP|-23.8491|-46.9432
4216909|sao lourenco do oeste|SC|-26.3557|-52.8498
2210359|sao lourenco do piaui|PI|-9.16463|-42.5496
4318804|sao lourenco do sul|RS|-31.3564|-51.9715
4217006|sao ludgero|SC|-28.3144|-49.1806
2111300|sao luis|MA|-2.53874|-44.2825
5220108|sao luis de montes belos|GO|-16.5211|-50.3726
2312601|sao luis do curu|CE|-3.66976|-39.2391
2210375|sao luis do piaui|PI|-6.81936|-41.3175
2708501|sao luis do quitunde|AL|-9.31816|-35.5606
2111409|sao luis gonzaga do maranhao|MA|-4.38541|-44.6654
1400605|sao luiz|RR|1.01019|-60.0419
5220157|sao luiz do norte|GO|-14.8608|-49.3285
3550001|sao luiz do paraitinga|SP|-23.222|-45.3109
4318903|sao luiz gonzaga|RS|-28.412|-54.9559
2514909|sao mamede|PB|-6.92386|-37.0954
4125555|sao manoel do parana|PR|-23.3941|-52.6454
3550100|sao manuel|SP|-22.7321|-48.5723
4319000|sao marcos|RS|-28.9677|-51.0696
4217105|sao martinho|SC|-28.1609|-48.9867
4319109|sao martinho|RS|-27.7112|-53.9699
4319125|sao martinho da serra|RS|-29.5397|-53.859
3204906|sao mateus|ES|-18.7214|-39.8579
2111508|sao mateus do maranhao|MA|-4.03736|-44.4707
4125605|sao mateus do sul|PR|-25.8677|-50.384
2412500|sao miguel|RN|-6.20283|-38.4947
3550209|sao miguel arcanjo|SP|-23.8782|-47.9935
2210383|sao miguel da baixa grande|PI|-5.85646|-42.1934
4217154|sao miguel da boa vista|SC|-26.687|-53.2511
2929404|sao miguel das matas|BA|-13.0434|-39.4578
4319158|sao miguel das missoes|RS|-28.556|-54.5559
2515005|sao miguel de taipu|PB|-7.24764|-35.2016
2807006|sao miguel do aleixo|SE|-10.3847|-37.3836
3163805|sao miguel do anta|MG|-20.7067|-42.7174
5220207|sao miguel do araguaia|GO|-13.2731|-50.1634
2210391|sao miguel do fidalgo|PI|-7.59713|-42.3676
2412559|sao miguel do gostoso|RN|-5.12302|-35.6354
1507607|sao miguel do guama|PA|-1.61307|-47.4784
1100320|sao miguel do guapore|RO|-11.6953|-62.7192
4125704|sao miguel do iguacu|PR|-25.3492|-54.2405
4217204|sao miguel do oeste|SC|-26.7242|-53.5163
5220264|sao miguel do passa quatro|GO|-17.0582|-48.662
2210409|sao miguel do tapuio|PI|-5.49729|-41.3165
1720200|sao miguel do tocantins|TO|-5.56305|-47.5743
2708600|sao miguel dos campos|AL|-9.78301|-36.0971
2708709|sao miguel dos milagres|AL|-9.26493|-35.3763
4319208|sao nicolau|RS|-28.1834|-55.2654
5220280|sao patricio|GO|-15.35|-49.818
3550308|sao paulo|SP|-23.5329|-46.6395
4319307|sao paulo das missoes|RS|-28.0195|-54.9404
1303908|sao paulo de olivenca|AM|-3.47292|-68.9646
2412609|sao paulo do potengi|RN|-5.8994|-35.7642
2412708|sao pedro|RN|-5.90559|-35.6317
3550407|sao pedro|SP|-22.5483|-47.9096
2111532|sao pedro da agua branca|MA|-5.08472|-48.4291
3305208|sao pedro da aldeia|RJ|-22.8429|-42.1026
5107404|sao pedro da cipa|MT|-16.0109|-54.9176
4319356|sao pedro da serra|RS|-29.4193|-51.5134
3163904|sao pedro da uniao|MG|-21.131|-46.6123
4319364|sao pedro das missoes|RS|-27.7706|-53.2513
4217253|sao pedro de alcantara|SC|-27.5665|-48.8048
4319372|sao pedro do butia|RS|-28.1243|-54.8926
4125753|sao pedro do iguacu|PR|-24.9373|-53.8521
4125803|sao pedro do ivai|PR|-23.8634|-51.8568
4125902|sao pedro do parana|PR|-22.8239|-53.2241
2210508|sao pedro do piaui|PI|-5.92078|-42.7192
3164100|sao pedro do suacui|MG|-18.3609|-42.5981
4319406|sao pedro do sul|RS|-29.6202|-54.1855
3550506|sao pedro do turvo|SP|-22.7453|-49.7428
2111573|sao pedro dos crentes|MA|-6.82389|-46.5319
3164001|sao pedro dos ferros|MG|-20.1732|-42.5251
2412807|sao rafael|RN|-5.79791|-36.8778
2111607|sao raimundo das mangabeiras|MA|-7.02183|-45.4809
2111631|sao raimundo do doca bezerra|MA|-5.11053|-45.0696
2210607|sao raimundo nonato|PI|-9.01241|-42.6987
2111672|sao roberto|MA|-5.0231|-45.001
3164209|sao romao|MG|-16.3641|-45.0749
3550605|sao roque|SP|-23.5226|-47.1357
3164308|sao roque de minas|MG|-20.249|-46.3639
3204955|sao roque do canaa|ES|-19.7411|-40.6526
1720259|sao salvador do tocantins|TO|-12.7458|-48.2352
3550704|sao sebastiao|SP|-23.7951|-45.4143
2708808|sao sebastiao|AL|-9.93043|-36.559
4126009|sao sebastiao da amoreira|PR|-23.4656|-50.7625
3164407|sao sebastiao da bela vista|MG|-22.1583|-45.7546
1507706|sao sebastiao da boa vista|PA|-1.71597|-49.5249
3550803|sao sebastiao da grama|SP|-21.7041|-46.8208
3164431|sao sebastiao da vargem alegre|MG|-19.7477|-43.3679
2515104|sao sebastiao de lagoa de roca|PB|-7.11034|-35.8678
3305307|sao sebastiao do alto|RJ|-21.9578|-42.1328
3164472|sao sebastiao do anta|MG|-19.5064|-41.985
4319505|sao sebastiao do cai|RS|-29.5885|-51.3749
3164506|sao sebastiao do maranhao|MG|-18.0873|-42.5659
3164605|sao sebastiao do oeste|MG|-20.2758|-45.0063
3164704|sao sebastiao do paraiso|MG|-20.9167|-46.9837
2929503|sao sebastiao do passe|BA|-12.5123|-38.4905
3164803|sao sebastiao do rio preto|MG|-19.2959|-43.1757
3164902|sao sebastiao do rio verde|MG|-22.2183|-44.9761
1720309|sao sebastiao do tocantins|TO|-5.26131|-48.2021
1303957|sao sebastiao do uatuma|AM|-2.55915|-57.8731
2515203|sao sebastiao do umbuzeiro|PB|-8.15289|-37.0138
4319604|sao sepe|RS|-30.1643|-53.5603
3550902|sao simao|SP|-21.4732|-47.5518
5220405|sao simao|GO|-18.996|-50.547
3165206|sao thome das letras|MG|-21.7218|-44.9849
3165008|sao tiago|MG|-20.9075|-44.5098
3165107|sao tomas de aquino|MG|-20.7791|-47.0962
4126108|sao tome|PR|-23.5349|-52.5901
2412906|sao tome|RN|-5.96404|-36.0798
4319703|sao valentim|RS|-27.5583|-52.5237
4319711|sao valentim do sul|RS|-29.0451|-51.7684
1720499|sao valerio|TO|-11.9743|-48.2353
4319737|sao valerio do sul|RS|-27.7906|-53.9368
4319752|sao vendelino|RS|-29.3729|-51.3675
3551009|sao vicente|SP|-23.9574|-46.3883
2413003|sao vicente|RN|-6.21893|-36.6827
3165305|sao vicente de minas|MG|-21.7042|-44.4431
2515401|sao vicente do serido|PB|-6.85426|-36.4122
4319802|sao vicente do sul|RS|-29.6882|-54.6826
2613800|sao vicente ferrer|PE|-7.58969|-35.4808
2111706|sao vicente ferrer|MA|-2.89487|-44.8681
2515302|sape|PB|-7.09359|-35.228
2929602|sapeacu|BA|-12.7208|-39.1824
5107875|sapezal|MT|-12.9892|-58.7645
4319901|sapiranga|RS|-29.6349|-51.0064
4126207|sapopema|PR|-23.9078|-50.5801
3165404|sapucai mirim|MG|-22.7409|-45.738
1507755|sapucaia|PA|-6.94018|-49.6834
3305406|sapucaia|RJ|-21.9949|-42.9142
4320008|sapucaia do sul|RS|-29.8276|-51.145
3305505|saquarema|RJ|-22.9292|-42.5099
4126256|sarandi|PR|-23.4441|-51.876
4320107|sarandi|RS|-27.942|-52.9231
3551108|sarapui|SP|-23.6397|-47.8249
3165503|sardoa|MG|-18.7828|-42.3629
3551207|sarutaia|SP|-23.2721|-49.4763
3165537|sarzedo|MG|-20.0367|-44.1446
2929701|satiro dias|BA|-11.5929|-38.5938
2708907|satuba|AL|-9.56911|-35.8227
2111722|satubinha|MA|-4.04913|-45.2457
2929750|saubara|BA|-12.7387|-38.7625
4126272|saudade do iguacu|PR|-25.6917|-52.6184
4217303|saudades|SC|-26.9317|-53.0021
2929800|saude|BA|-10.9428|-40.4155
4217402|schroeder|SC|-26.4116|-49.074
2929909|seabra|BA|-12.4169|-41.7722
4217501|seara|SC|-27.1564|-52.299
3551306|sebastianopolis do sul|SP|-20.6523|-49.925
2210623|sebastiao barros|PI|-10.817|-44.8337
2930006|sebastiao laranjeiras|BA|-14.571|-42.9434
2210631|sebastiao leal|PI|-7.56803|-44.06
4320206|seberi|RS|-27.4829|-53.4026
4320230|sede nova|RS|-27.6367|-53.9493
4320263|segredo|RS|-29.3523|-52.9767
4320305|selbach|RS|-28.6294|-52.9498
5007802|selviria|MS|-20.3637|-51.4192
3165560|sem peixe|MG|-20.1008|-42.8483
1200500|sena madureira|AC|-9.06596|-68.6571
2111748|senador alexandre costa|MA|-5.25096|-44.0533
3165578|senador amaral|MG|-22.5869|-46.1763
5220454|senador canedo|GO|-16.7084|-49.0914
3165602|senador cortes|MG|-21.7986|-42.9424
2413102|senador eloi de souza|RN|-6.03334|-35.6978
3165701|senador firmino|MG|-20.9158|-43.0904
2413201|senador georgino avelino|RN|-6.1576|-35.1299
1200450|senador guiomard|AC|-10.1497|-67.7362
3165800|senador jose bento|MG|-22.1633|-46.1792
1507805|senador jose porfirio|PA|-4.31242|-51.5764
2111763|senador la rocque|MA|-5.4461|-47.2959
3165909|senador modestino goncalves|MG|-17.9465|-43.2172
2312700|senador pompeu|CE|-5.58244|-39.3704
2708956|senador rui palmeira|AL|-9.46986|-37.4576
2312809|senador sa|CE|-3.35305|-40.4662
4320321|senador salgado filho|RS|-28.025|-54.5507
4126306|senges|PR|-24.1129|-49.4616
2930105|senhor do bonfim|BA|-10.4594|-40.1865
3166006|senhora de oliveira|MG|-20.7972|-43.3394
3166105|senhora do porto|MG|-18.8909|-43.0799
3166204|senhora dos remedios|MG|-21.0351|-43.5812
4320354|sentinela do sul|RS|-30.6107|-51.5862
2930204|sento se|BA|-9.74138|-41.8786
4320404|serafina correa|RS|-28.7126|-51.9352
3166303|sericita|MG|-20.4748|-42.4828
1101500|seringueiras|RO|-11.8055|-63.0182
4320453|serio|RS|-29.3904|-52.2685
3166402|seritinga|MG|-21.9134|-44.518
3305554|seropedica|RJ|-22.7526|-43.7155
3205002|serra|ES|-20.121|-40.3074
4217550|serra alta|SC|-26.7229|-53.0409
3551405|serra azul|SP|-21.3074|-47.5602
3166501|serra azul de minas|MG|-18.3602|-43.1675
2515500|serra branca|PB|-7.48034|-36.666
2410306|serra caiada|RN|-6.10478|-35.7113
2515609|serra da raiz|PB|-6.68527|-35.4379
3166600|serra da saudade|MG|-19.4447|-45.795
2413300|serra de sao bento|RN|-6.41762|-35.7033
2413359|serra do mel|RN|-5.17725|-37.0242
1600055|serra do navio|AP|0.901357|-52.0036
2930154|serra do ramalho|BA|-13.5659|-43.5929
3166808|serra do salitre|MG|-19.1083|-46.6961
3166709|serra dos aimores|MG|-17.7872|-40.2453
2930303|serra dourada|BA|-12.759|-43.9504
2515708|serra grande|PB|-7.20957|-38.3647
3551603|serra negra|SP|-22.6139|-46.7033
2413409|serra negra do norte|RN|-6.66031|-37.3996
5107883|serra nova dourada|MT|-12.0896|-51.4025
2930402|serra preta|BA|-12.156|-39.3305
2515807|serra redonda|PB|-7.18622|-35.6842
2613909|serra talhada|PE|-7.98178|-38.289
3551504|serrana|SP|-21.2043|-47.5952
3166907|serrania|MG|-21.5441|-46.0417
2111789|serrano do maranhao|MA|-1.85229|-45.1207
5220504|serranopolis|GO|-18.3067|-51.9586
3166956|serranopolis de minas|MG|-15.8176|-42.8732
4126355|serranopolis do iguacu|PR|-25.3799|-54.0518
3167004|serranos|MG|-21.8857|-44.5125
2515906|serraria|PB|-6.81569|-35.6282
2413508|serrinha|RN|-6.28181|-35.5
2930501|serrinha|BA|-11.6584|-39.01
2413557|serrinha dos pintos|RN|-6.11087|-37.9548
2614006|serrita|PE|-7.94041|-39.2951
3167103|serro|MG|-18.5991|-43.3744
2930600|serrolandia|BA|-11.4085|-40.2983
4126405|sertaneja|PR|-23.0361|-50.8317
2614105|sertania|PE|-8.06847|-37.2684
4126504|sertanopolis|PR|-23.0571|-51.0399
4320503|sertao|RS|-27.9798|-52.2588
4320552|sertao santana|RS|-30.4562|-51.6017
3551702|sertaozinho|SP|-21.1316|-47.9875
2515930|sertaozinho|PB|-6.75127|-35.4372
3551801|sete barras|SP|-24.382|-47.9279
4320578|sete de setembro|RS|-28.1362|-54.4637
3167202|sete lagoas|MG|-19.4569|-44.2413
5007703|sete quedas|MS|-23.9705|-55.0398
3165552|setubinha|MG|-17.6002|-42.1587
4320602|severiano de almeida|RS|-27.4362|-52.1217
2413607|severiano melo|RN|-5.77666|-37.957
3551900|severinia|SP|-20.8108|-48.8054
4217600|sideropolis|SC|-28.5955|-49.4314
5007901|sidrolandia|MS|-20.9302|-54.9692
2210656|sigefredo pacheco|PI|-4.91665|-41.7311
3305604|silva jardim|RJ|-22.6574|-42.3961
5220603|silvania|GO|-16.66|-48.6083
1720655|silvanopolis|TO|-11.1471|-48.1694
4320651|silveira martins|RS|-29.6467|-53.591
3167301|silveirania|MG|-21.1615|-43.2128
3552007|silveiras|SP|-22.6638|-44.8522
1304005|silves|AM|-2.81748|-58.248
3167400|silvianopolis|MG|-22.0274|-45.8385
2807105|simao dias|SE|-10.7387|-37.8097
3167509|simao pereira|MG|-21.964|-43.3088
2210706|simoes|PI|-7.59109|-40.8137
2930709|simoes filho|BA|-12.7866|-38.4029
5220686|simolandia|GO|-14.4644|-46.4847
3167608|simonesia|MG|-20.1341|-42.0091
2210805|simplicio mendes|PI|-7.85294|-41.9075
4320677|sinimbu|RS|-29.5357|-52.5304
5107909|sinop|MT|-11.8604|-55.5091
4126603|siqueira campos|PR|-23.6875|-49.8304
2614204|sirinhaem|PE|-8.58778|-35.1126
2807204|siriri|SE|-10.5965|-37.1131
5220702|sitio d abadia|GO|-14.7992|-46.2506
2930758|sitio do mato|BA|-13.0801|-43.4689
2930766|sitio do quinto|BA|-10.3545|-38.2213
2111805|sitio novo|MA|-5.87601|-46.7033
2413706|sitio novo|RN|-6.11132|-35.909
1720804|sitio novo do tocantins|TO|-5.6012|-47.6381
2930774|sobradinho|BA|-9.45024|-40.8145
4320701|sobradinho|RS|-29.4194|-53.0326
2515971|sobrado|PB|-7.14429|-35.2357
2312908|sobral|CE|-3.68913|-40.3482
3167707|sobralia|MG|-19.2345|-42.0998
3552106|socorro|SP|-22.5903|-46.5251
2210904|socorro do piaui|PI|-7.86773|-42.4922
2516003|solanea|PB|-6.75161|-35.6636
2516102|soledade|PB|-7.05829|-36.3668
4320800|soledade|RS|-28.8306|-52.5131
3167806|soledade de minas|MG|-22.0554|-45.0464
2614402|solidao|PE|-7.59472|-37.6445
2313005|solonopole|CE|-5.71894|-39.0107
4217709|sombrio|SC|-29.108|-49.6328
5007935|sonora|MS|-17.5698|-54.7551
3205010|sooretama|ES|-19.1897|-40.0974
3552205|sorocaba|SP|-23.4969|-47.4451
5107925|sorriso|MT|-12.5425|-55.7211
2516151|sossego|PB|-6.77067|-36.2538
1507904|soure|PA|-0.73032|-48.5015
2516201|sousa|PB|-6.75148|-38.2311
2930808|souto soares|BA|-12.088|-41.6427
1720853|sucupira|TO|-11.993|-48.9685
2111904|sucupira do norte|MA|-6.47839|-44.1919
2111953|sucupira do riachao|MA|-6.40858|-43.5455
3552304|sud mennucci|SP|-20.6872|-50.9238
4217758|sul brasil|SC|-26.7351|-52.964
4126652|sulina|PR|-25.7066|-52.7299
3552403|sumare|SP|-22.8204|-47.2728
2516300|sume|PB|-7.66206|-36.884
3305703|sumidouro|RJ|-22.0485|-42.6761
2614501|surubim|PE|-7.84746|-35.7481
2210938|sussuapara|PI|-7.03687|-41.3767
3552551|suzanapolis|SP|-20.4981|-51.0268
3552502|suzano|SP|-23.5448|-46.3112
4320859|tabai|RS|-29.643|-51.6823
5107941|tabapora|MT|-11.3007|-56.8312
3552601|tabapua|SP|-20.9602|-49.0307
3552700|tabatinga|SP|-21.7239|-48.6896
1304062|tabatinga|AM|-4.2416|-69.9383
2614600|tabira|PE|-7.58366|-37.5377
3552809|taboao da serra|SP|-23.6019|-46.7526
2930907|tabocas do brejo velho|BA|-12.7026|-44.0075
2413805|taboleiro grande|RN|-5.91948|-38.0367
3167905|tabuleiro|MG|-21.3632|-43.2381
2313104|tabuleiro do norte|CE|-5.24353|-38.1282
2614709|tacaimbo|PE|-8.30867|-36.3
2614808|tacaratu|PE|-9.09798|-38.1504
3552908|taciba|SP|-22.3866|-51.2882
2516409|tacima|PB|-6.48759|-35.6367
5007950|tacuru|MS|-23.636|-55.0141
3553005|taguai|SP|-23.4452|-49.4024
1720903|taguatinga|TO|-12.4026|-46.437
3553104|taiacu|SP|-21.1431|-48.5112
1507953|tailandia|PA|-2.94584|-48.9489
4217808|taio|SC|-27.121|-49.9942
3168002|taiobeiras|MG|-15.8106|-42.2259
1720937|taipas do tocantins|TO|-12.1873|-46.9797
2413904|taipu|RN|-5.63058|-35.5918
3553203|taiuva|SP|-21.1223|-48.4528
1720978|talisma|TO|-12.7949|-49.0896
2614857|tamandare|PE|-8.75665|-35.1033
4126678|tamarana|PR|-23.7204|-51.0991
3553302|tambau|SP|-21.7029|-47.2703
4126702|tamboara|PR|-23.2036|-52.4743
2313203|tamboril|CE|-4.83136|-40.3196
2210953|tamboril do piaui|PI|-8.40937|-42.9211
3553401|tanabi|SP|-20.6228|-49.6563
2414001|tangara|RN|-6.19649|-35.7989
4217907|tangara|SC|-27.0996|-51.2473
5107958|tangara da serra|MT|-14.6229|-57.4933
3305752|tangua|RJ|-22.7423|-42.7202
2931004|tanhacu|BA|-14.0197|-41.2473
2709004|tanque d arca|AL|-9.53379|-36.4366
2210979|tanque do piaui|PI|-6.59787|-42.2795
2931053|tanque novo|BA|-13.5485|-42.4934
2931103|tanquinho|BA|-11.968|-39.1033
3168051|taparuba|MG|-19.7621|-41.608
1304104|tapaua|AM|-5.62085|-63.1808
4126801|tapejara|PR|-23.7315|-52.8735
4320909|tapejara|RS|-28.0652|-52.0097
4321006|tapera|RS|-28.6277|-52.8613
2931202|taperoa|BA|-13.5321|-39.1009
2516508|taperoa|PB|-7.20629|-36.8245
4321105|tapes|RS|-30.6683|-51.3991
4126900|tapira|PR|-23.3193|-53.0684
3168101|tapira|MG|-19.9166|-46.8264
3168200|tapirai|MG|-19.8936|-46.0221
3553500|tapirai|SP|-23.9612|-47.5062
2931301|tapiramuta|BA|-11.8475|-40.7927
3553609|tapiratiba|SP|-21.4713|-46.7448
5108006|tapurah|MT|-12.695|-56.5178
4321204|taquara|RS|-29.6505|-50.7753
3168309|taquaracu de minas|MG|-19.6652|-43.6922
3553658|taquaral|SP|-21.0737|-48.4126
5221007|taquaral de goias|GO|-16.0521|-49.6039
2709103|taquarana|AL|-9.64529|-36.4928
4321303|taquari|RS|-29.7943|-51.8653
3553708|taquaritinga|SP|-21.4049|-48.5103
2615003|taquaritinga do norte|PE|-7.89446|-36.0423
3553807|taquarituba|SP|-23.5307|-49.241
3553856|taquarivai|SP|-23.9211|-48.6948
4321329|taquarucu do sul|RS|-27.4005|-53.4702
5007976|taquarussu|MS|-22.4898|-53.3519
3553906|tarabai|SP|-22.3016|-51.5621
1200609|tarauaca|AC|-8.15697|-70.7722
2313252|tarrafas|CE|-6.67838|-39.753
1600709|tartarugalzinho|AP|1.50652|-50.9087
3553955|taruma|SP|-22.7429|-50.5786
3168408|tarumirim|MG|-19.2835|-42.0097
2112001|tasso fragoso|MA|-8.4662|-45.7536
3554003|tatui|SP|-23.3487|-47.8461
2313302|taua|CE|-5.98585|-40.2968
3554102|taubate|SP|-23.0104|-45.5593
4321352|tavares|RS|-31.2843|-51.088
2516607|tavares|PB|-7.62697|-37.8712
1304203|tefe|AM|-3.36822|-64.7193
2516706|teixeira|PB|-7.22104|-37.2525
2931350|teixeira de freitas|BA|-17.5399|-39.74
4127007|teixeira soares|PR|-25.3701|-50.4571
3168507|teixeiras|MG|-20.6561|-42.8564
1101559|teixeiropolis|RO|-10.9056|-62.242
2313351|tejucuoca|CE|-3.98831|-39.5799
3554201|tejupa|SP|-23.3425|-49.3722
4127106|telemaco borba|PR|-24.3245|-50.6176
2807303|telha|SE|-10.2064|-36.8818
2414100|tenente ananias|RN|-6.45823|-38.182
2414159|tenente laurentino cruz|RN|-6.1378|-36.7135
4321402|tenente portela|RS|-27.3711|-53.7585
2516755|tenorio|PB|-6.93855|-36.6273
2931400|teodoro sampaio|BA|-12.295|-38.6347
3554300|teodoro sampaio|SP|-22.5299|-52.1682
2931509|teofilandia|BA|-11.4827|-38.9913
3168606|teofilo otoni|MG|-17.8595|-41.5087
2931608|teolandia|BA|-13.5896|-39.484
2709152|teotonio vilela|AL|-9.91656|-36.3492
5008008|terenos|MS|-20.4378|-54.8647
2211001|teresina|PI|-5.09194|-42.8034
5221080|teresina de goias|GO|-13.7801|-47.2659
3305802|teresopolis|RJ|-22.4165|-42.9752
2615102|terezinha|PE|-9.05621|-36.6272
5221197|terezopolis de goias|GO|-16.3945|-49.0797
1507961|terra alta|PA|-1.02963|-47.9004
4127205|terra boa|PR|-23.7683|-52.447
4321436|terra de areia|RS|-29.5782|-50.0644
2931707|terra nova|BA|-12.3888|-38.6238
2615201|terra nova|PE|-8.22244|-39.3825
5108055|terra nova do norte|MT|-10.517|-55.231
4127304|terra rica|PR|-22.7111|-52.6188
4127403|terra roxa|PR|-24.1575|-54.0988
3554409|terra roxa|SP|-20.787|-48.3314
1507979|terra santa|PA|-2.10443|-56.4877
5108105|tesouro|MT|-16.0809|-53.559
4321451|teutonia|RS|-29.4482|-51.8044
1101609|theobroma|RO|-10.2483|-62.3538
2313401|tiangua|CE|-3.72965|-40.9923
4127502|tibagi|PR|-24.5153|-50.4176
2411056|tibau|RN|-4.83729|-37.2554
2414209|tibau do sul|RN|-6.19176|-35.0866
3554508|tiete|SP|-23.1101|-47.7164
4217956|tigrinhos|SC|-26.6876|-53.1545
4218004|tijucas|SC|-27.2354|-48.6322
4127601|tijucas do sul|PR|-25.9311|-49.195
2615300|timbauba|PE|-7.50484|-35.3119
2414308|timbauba dos batistas|RN|-6.45768|-37.2745
4218103|timbe do sul|SC|-28.8287|-49.842
2112100|timbiras|MA|-4.25597|-43.932
4218202|timbo|SC|-26.8246|-49.269
4218251|timbo grande|SC|-26.6127|-50.6607
3554607|timburi|SP|-23.2057|-49.6096
2112209|timon|MA|-5.09769|-42.8329
3168705|timoteo|MG|-19.5811|-42.6471
4321469|tio hugo|RS|-28.5712|-52.5955
3168804|tiradentes|MG|-21.1102|-44.1744
4321477|tiradentes do sul|RS|-27.4022|-54.0814
3168903|tiros|MG|-19.0037|-45.9626
2807402|tobias barreto|SE|-11.1798|-37.9995
1721109|tocantinia|TO|-9.5632|-48.3741
1721208|tocantinopolis|TO|-6.32447|-47.4224
3169000|tocantins|MG|-21.1774|-43.0127
3169059|tocos do moji|MG|-22.3698|-46.0971
3169109|toledo|MG|-22.7421|-46.3728
4127700|toledo|PR|-24.7246|-53.7412
2807501|tomar do geru|SE|-11.3694|-37.8433
4127809|tomazina|PR|-23.7796|-49.9499
3169208|tombos|MG|-20.9086|-42.0228
1508001|tome acu|PA|-2.41302|-48.1415
1304237|tonantins|AM|-2.86582|-67.7919
2615409|toritama|PE|-8.00955|-36.0637
5108204|torixoreu|MT|-16.2006|-52.5571
4321493|toropi|RS|-29.4782|-54.2244
3554656|torre de pedra|SP|-23.2462|-48.1955
4321501|torres|RS|-29.3334|-49.7333
3554706|torrinha|SP|-22.4237|-48.1731
2414407|touros|RN|-5.20182|-35.4621
3554755|trabiju|SP|-22.0388|-48.3342
1508035|tracuateua|PA|-1.07653|-46.9031
2615508|tracunhaem|PE|-7.80228|-35.2314
2709202|traipu|AL|-9.96262|-37.0071
1508050|trairao|PA|-4.57347|-55.9429
2313500|trairi|CE|-3.26932|-39.2681
3305901|trajano de moraes|RJ|-22.0638|-42.0643
4321600|tramandai|RS|-29.9841|-50.1322
4321626|travesseiro|RS|-29.2977|-52.0532
2931806|tremedal|BA|-14.9736|-41.4142
3554805|tremembe|SP|-22.9571|-45.5475
4321634|tres arroios|RS|-27.5003|-52.1448
4218301|tres barras|SC|-26.1056|-50.3197
4127858|tres barras do parana|PR|-25.4185|-53.1833
4321667|tres cachoeiras|RS|-29.4487|-49.9275
3169307|tres coracoes|MG|-21.6921|-45.2511
4321709|tres coroas|RS|-29.5137|-50.7739
4321808|tres de maio|RS|-27.78|-54.2357
4321832|tres forquilhas|RS|-29.5384|-50.0708
3554904|tres fronteiras|SP|-20.2344|-50.8905
5008305|tres lagoas|MS|-20.7849|-51.7007
3169356|tres marias|MG|-18.2048|-45.2473
4321857|tres palmeiras|RS|-27.6139|-52.8437
4321907|tres passos|RS|-27.4555|-53.9296
3169406|tres pontas|MG|-21.3694|-45.5109
5221304|tres ranchos|GO|-18.3539|-47.776
3306008|tres rios|RJ|-22.1165|-43.2185
4218350|treviso|SC|-28.5097|-49.4634
4218400|treze de maio|SC|-28.5537|-49.1565
4218509|treze tilias|SC|-27.0026|-51.4084
5221403|trindade|GO|-16.6517|-49.4927
2615607|trindade|PE|-7.759|-40.2647
4321956|trindade do sul|RS|-27.5239|-52.8956
4322004|triunfo|RS|-29.9291|-51.7075
2516805|triunfo|PB|-6.5713|-38.5986
2615706|triunfo|PE|-7.83272|-38.0978
2414456|triunfo potiguar|RN|-5.85408|-37.1786
2112233|trizidela do vale|MA|-4.538|-44.628
5221452|trombas|GO|-13.5079|-48.7417
4218608|trombudo central|SC|-27.3033|-49.793
4218707|tubarao|SC|-28.4713|-49.0144
2931905|tucano|BA|-10.9584|-38.7894
1508084|tucuma|PA|-6.74687|-51.1626
4322103|tucunduva|RS|-27.6573|-54.4439
1508100|tucurui|PA|-3.7657|-49.6773
2112274|tufilandia|MA|-3.67355|-45.6238
3554953|tuiuti|SP|-22.8193|-46.6937
3169505|tumiritinga|MG|-18.9844|-41.6527
4218756|tunapolis|SC|-26.9681|-53.6417
4322152|tunas|RS|-29.1039|-52.9538
4127882|tunas do parana|PR|-24.9731|-49.0879
4127908|tuneiras do oeste|PR|-23.8648|-52.8769
2112308|tuntum|MA|-5.25476|-44.6444
3555000|tupa|SP|-21.9335|-50.5191
3169604|tupaciguara|MG|-18.5866|-48.6985
2615805|tupanatinga|PE|-8.74798|-37.3445
4322186|tupanci do sul|RS|-27.9241|-51.5383
4322202|tupancireta|RS|-29.0858|-53.8445
4322251|tupandi|RS|-29.4772|-51.4174
4322301|tuparendi|RS|-27.7598|-54.4814
2615904|tuparetama|PE|-7.6003|-37.3165
4127957|tupassi|PR|-24.5879|-53.5105
3555109|tupi paulista|SP|-21.3825|-51.575
1721257|tupirama|TO|-8.97168|-48.1883
1721307|tupiratins|TO|-8.39388|-48.1277
2112407|turiacu|MA|-1.65893|-45.3798
2112456|turilandia|MA|-2.21638|-45.3044
3555208|turiuba|SP|-20.9428|-50.1135
3555307|turmalina|SP|-20.0486|-50.4792
3169703|turmalina|MG|-17.2828|-42.7285
4322327|turucu|RS|-31.4173|-52.1706
2313559|tururu|CE|-3.58413|-39.4297
5221502|turvania|GO|-16.6125|-50.1369
5221551|turvelandia|GO|-17.8502|-50.3024
4127965|turvo|PR|-25.0437|-51.5282
4218806|turvo|SC|-28.9272|-49.6831
3169802|turvolandia|MG|-21.8733|-45.7859
2112506|tutoia|MA|-2.76141|-42.2755
1304260|uarini|AM|-2.99609|-65.1133
2932002|uaua|BA|-9.83325|-39.4794
3169901|uba|MG|-21.1204|-42.9359
3170008|ubai|MG|-16.2885|-44.7783
2932101|ubaira|BA|-13.2714|-39.666
2932200|ubaitaba|BA|-14.303|-39.3222
2313609|ubajara|CE|-3.85448|-40.9204
3170057|ubaporanga|MG|-19.6351|-42.1059
3555356|ubarana|SP|-21.165|-49.7198
2932309|ubata|BA|-14.2063|-39.5207
3555406|ubatuba|SP|-23.4332|-45.0834
3170107|uberaba|MG|-19.7472|-47.9381
3170206|uberlandia|MG|-18.9141|-48.2749
3555505|ubirajara|SP|-22.5272|-49.6613
4128005|ubirata|PR|-24.5393|-52.9865
4322343|ubiretama|RS|-28.0404|-54.686
3555604|uchoa|SP|-20.9511|-49.1713
2932408|uibai|BA|-11.3394|-42.1354
1400704|uiramuta|RR|4.60314|-60.1815
5221577|uirapuru|GO|-14.2835|-49.9201
2516904|uirauna|PB|-6.51504|-38.4128
1508126|ulianopolis|PA|-3.75007|-47.4892
2313708|umari|CE|-6.63893|-38.7008
2414506|umarizal|RN|-5.98238|-37.818
2807600|umbauba|SE|-11.3809|-37.6623
2932457|umburanas|BA|-10.7339|-41.3234
3170305|umburatiba|MG|-17.2548|-40.5779
2517001|umbuzeiro|PB|-7.69199|-35.6582
2313757|umirim|CE|-3.67654|-39.3465
4128104|umuarama|PR|-23.7656|-53.3201
2932507|una|BA|-15.2791|-39.0765
3170404|unai|MG|-16.3592|-46.9022
2211100|uniao|PI|-4.58571|-42.8583
4322350|uniao da serra|RS|-28.7833|-52.0238
4128203|uniao da vitoria|PR|-26.2273|-51.0873
3170438|uniao de minas|MG|-19.5299|-50.338
4218855|uniao do oeste|SC|-26.762|-52.8541
5108303|uniao do sul|MT|-11.5308|-54.3616
2709301|uniao dos palmares|AL|-9.15921|-36.0223
3555703|uniao paulista|SP|-20.8862|-49.9025
4128302|uniflor|PR|-23.0868|-52.1573
4322376|unistalda|RS|-29.04|-55.1517
2414605|upanema|RN|-5.63761|-37.2635
4128401|urai|PR|-23.2|-50.7939
2932606|urandi|BA|-14.7678|-42.6498
3555802|urania|SP|-20.2455|-50.6455
2112605|urbano santos|MA|-3.20642|-43.3878
3555901|uru|SP|-21.7866|-49.2848
5221601|uruacu|GO|-14.5238|-49.1396
5221700|uruana|GO|-15.4993|-49.6861
3170479|uruana de minas|MG|-16.0634|-46.2443
1508159|uruara|PA|-3.71519|-53.7396
4218905|urubici|SC|-28.0157|-49.5925
2313807|uruburetama|CE|-3.62316|-39.5107
3170503|urucania|MG|-20.3521|-42.737
1304302|urucara|AM|-2.52936|-57.7538
2932705|urucuca|BA|-14.5963|-39.2851
2211209|urucui|PI|-7.23944|-44.5577
3170529|urucuia|MG|-16.1244|-45.7352
1304401|urucurituba|AM|-3.12841|-58.1496
4322400|uruguaiana|RS|-29.7614|-57.0853
2313906|uruoca|CE|-3.30819|-40.5628
1101708|urupa|RO|-11.1261|-62.3639
4218954|urupema|SC|-27.9557|-49.8729
3556008|urupes|SP|-21.2032|-49.2931
4219002|urussanga|SC|-28.518|-49.3238
5221809|urutai|GO|-17.4651|-48.2015
2932804|utinga|BA|-12.0783|-41.0954
4322509|vacaria|RS|-28.5079|-50.9418
5108352|vale de sao domingos|MT|-15.286|-59.0683
1101757|vale do anari|RO|-9.86215|-62.1876
1101807|vale do paraiso|RO|-10.4465|-62.1352
4322533|vale do sol|RS|-29.5967|-52.6839
4322541|vale real|RS|-29.3919|-51.2559
4322525|vale verde|RS|-29.7864|-52.1857
2932903|valenca|BA|-13.3669|-39.073
3306107|valenca|RJ|-22.2445|-43.7129
2211308|valenca do piaui|PI|-6.40301|-41.7375
2933000|valente|BA|-11.4062|-39.457
3556107|valentim gentil|SP|-20.4217|-50.0889
3556206|valinhos|SP|-22.9698|-46.9974
3556305|valparaiso|SP|-21.2229|-50.8699
5221858|valparaiso de goias|GO|-16.0651|-47.9757
4322558|vanini|RS|-28.4758|-51.8447
4219101|vargeao|SC|-26.8621|-52.1549
4219150|vargem|SC|-27.4867|-50.9724
3556354|vargem|SP|-22.887|-46.4124
3170578|vargem alegre|MG|-19.5988|-42.2949
3205036|vargem alta|ES|-20.669|-41.0179
3170602|vargem bonita|MG|-20.3333|-46.3688
4219176|vargem bonita|SC|-27.0055|-51.7402
2112704|vargem grande|MA|-3.53639|-43.917
3170651|vargem grande do rio pardo|MG|-15.3987|-42.3085
3556404|vargem grande do sul|SP|-21.8322|-46.8913
3556453|vargem grande paulista|SP|-23.5993|-47.022
3170701|varginha|MG|-21.5556|-45.4364
5221908|varjao|GO|-17.0471|-49.6312
3170750|varjao de minas|MG|-18.3741|-46.0313
2313955|varjota|CE|-4.19387|-40.4741
3306156|varre sai|RJ|-20.9276|-41.8701
2414704|varzea|RN|-6.34641|-35.3732
2517100|varzea|PB|-6.76189|-36.9913
2314003|varzea alegre|CE|-6.78264|-39.2942
2211357|varzea branca|PI|-9.238|-42.9692
3170800|varzea da palma|MG|-17.5944|-44.7226
2933059|varzea da roca|BA|-11.6005|-40.1328
2933109|varzea do poco|BA|-11.5273|-40.3149
2211407|varzea grande|PI|-6.54899|-42.248
5108402|varzea grande|MT|-15.6458|-56.1322
2933158|varzea nova|BA|-11.2557|-40.9432
3556503|varzea paulista|SP|-23.2136|-46.8234
2933174|varzedo|BA|-12.9672|-39.3919
3170909|varzelandia|MG|-15.6992|-44.0278
3306206|vassouras|RJ|-22.4059|-43.6686
3171006|vazante|MG|-17.9827|-46.9088
4322608|venancio aires|RS|-29.6143|-52.1932
3205069|venda nova do imigrante|ES|-20.327|-41.1355
2414753|venha ver|RN|-6.32016|-38.4896
4128534|ventania|PR|-24.2458|-50.2376
2616001|venturosa|PE|-8.57885|-36.8742
5108501|vera|MT|-12.3017|-55.3045
2414803|vera cruz|RN|-6.04399|-35.428
2933208|vera cruz|BA|-12.9568|-38.6153
4322707|vera cruz|RS|-29.7184|-52.5152
3556602|vera cruz|SP|-22.2183|-49.8207
4128559|vera cruz do oeste|PR|-25.0577|-53.8771
2211506|vera mendes|PI|-7.59748|-41.4673
4322806|veranopolis|RS|-28.9312|-51.5516
2616100|verdejante|PE|-7.92235|-38.9701
3171030|verdelandia|MG|-15.5845|-43.6121
4128609|vere|PR|-25.8772|-52.9051
2933257|vereda|BA|-17.2183|-40.0974
3171071|veredinha|MG|-17.3974|-42.7307
3171105|verissimo|MG|-19.6657|-48.3118
3171154|vermelho novo|MG|-20.0406|-42.2688
2616183|vertente do lerio|PE|-7.77084|-35.8491
2616209|vertentes|PE|-7.90158|-35.9681
3171204|vespasiano|MG|-19.6883|-43.9239
4322855|vespasiano correa|RS|-29.0655|-51.8625
4322905|viadutos|RS|-27.5716|-52.0211
4323002|viamao|RS|-30.0819|-51.0194
3205101|viana|ES|-20.3825|-40.4933
2112803|viana|MA|-3.20451|-44.9912
5222005|vianopolis|GO|-16.7405|-48.5159
2616308|vicencia|PE|-7.65655|-35.3139
4323101|vicente dutra|RS|-27.1607|-53.4022
5008404|vicentina|MS|-22.4098|-54.4415
5222054|vicentinopolis|GO|-17.7322|-49.8047
2414902|vicosa|RN|-5.98253|-37.9462
2709400|vicosa|AL|-9.36763|-36.2431
3171303|vicosa|MG|-20.7559|-42.8742
2314102|vicosa do ceara|CE|-3.5667|-41.0916
4323200|victor graeff|RS|-28.5632|-52.7495
4219200|vidal ramos|SC|-27.3886|-49.3593
4219309|videira|SC|-27.0086|-51.1543
3171402|vieiras|MG|-20.867|-42.2401
2517209|vieiropolis|PB|-6.50684|-38.2567
1508209|vigia|PA|-0.861194|-48.1386
5105507|vila bela da santissima trindade|MT|-15.0068|-59.9504
5222203|vila boa|GO|-15.0387|-47.052
2415008|vila flor|RN|-6.31287|-35.067
4323309|vila flores|RS|-28.8598|-51.5504
4323358|vila langaro|RS|-28.1062|-52.1438
4323408|vila maria|RS|-28.5359|-52.1486
2211605|vila nova do piaui|PI|-7.13272|-40.9345
4323457|vila nova do sul|RS|-30.3461|-53.876
2112852|vila nova dos martirios|MA|-5.18889|-48.1336
3205150|vila pavao|ES|-18.6091|-40.609
5222302|vila propicio|GO|-15.4542|-48.8819
5108600|vila rica|MT|-10.0137|-51.1186
3205176|vila valerio|ES|-18.9958|-40.3849
3205200|vila velha|ES|-20.3417|-40.2875
1100304|vilhena|RO|-12.7502|-60.1488
3556701|vinhedo|SP|-23.0302|-46.9833
3556800|viradouro|SP|-20.8734|-48.293
3171600|virgem da lapa|MG|-16.807|-42.3431
3171709|virginia|MG|-22.3264|-45.0965
3171808|virginopolis|MG|-18.8154|-42.7015
3171907|virgolandia|MG|-18.4738|-42.3067
4128658|virmond|PR|-25.3829|-52.1987
3172004|visconde do rio branco|MG|-21.0127|-42.8361
1508308|viseu|PA|-1.19124|-46.1399
4323507|vista alegre|RS|-27.3686|-53.4919
3556909|vista alegre do alto|SP|-21.1692|-48.6284
4323606|vista alegre do prata|RS|-28.8052|-51.7947
4323705|vista gaucha|RS|-27.2902|-53.6974
2505501|vista serrana|PB|-6.7303|-37.5704
4219358|vitor meireles|SC|-26.8782|-49.8328
3205309|vitoria|ES|-20.3155|-40.3128
3556958|vitoria brasil|SP|-20.1956|-50.4875
2933307|vitoria da conquista|BA|-14.8615|-40.8442
4323754|vitoria das missoes|RS|-28.3516|-54.504
2616407|vitoria de santo antao|PE|-8.12819|-35.2976
1600808|vitoria do jari|AP|-0.938|-52.424
2112902|vitoria do mearim|MA|-3.45125|-44.8643
1508357|vitoria do xingu|PA|-2.87922|-52.0088
4128708|vitorino|PR|-26.2683|-52.7843
2113009|vitorino freire|MA|-4.28184|-45.2505
3172103|volta grande|MG|-21.7671|-42.5375
3306305|volta redonda|RJ|-22.5202|-44.0996
3557006|votorantim|SP|-23.5446|-47.4388
3557105|votuporanga|SP|-20.4237|-49.9781
2933406|wagner|BA|-12.2819|-41.1715
2211704|wall ferraz|PI|-7.23151|-41.905
1722081|wanderlandia|TO|-6.85274|-47.9601
2933455|wanderley|BA|-12.1144|-43.8958
3172202|wenceslau braz|MG|-22.5368|-45.3626
4128500|wenceslau braz|PR|-23.8742|-49.8032
2933505|wenceslau guimaraes|BA|-13.6908|-39.4762
4323770|westfalia|RS|-29.4263|-51.7645
4219408|witmarsum|SC|-26.9275|-49.7947
1722107|xambioa|TO|-6.4141|-48.532
4128807|xambre|PR|-23.7364|-53.4884
4323804|xangri la|RS|-29.8065|-50.0519
4219507|xanxere|SC|-26.8747|-52.4036
1200708|xapuri|AC|-10.6516|-68.4969
4219606|xavantina|SC|-27.0667|-52.343
4219705|xaxim|SC|-26.9596|-52.5374
2616506|xexeu|PE|-8.8046|-35.6212
1508407|xinguara|PA|-7.0983|-49.9437
2933604|xique xique|BA|-10.823|-42.7245
2517407|zabele|PB|-8.07901|-37.1057
3557154|zacarias|SP|-21.0506|-50.0552
2114007|ze doca|MA|-3.27014|-45.6553
4219853|zortea|SC|-27.4521|-51.552
5101837|boa esperanca do norte|MT|-13.5067|-55.1486`;

let indice: Map<string, MunicipioBrasileiro> | null = null;

/** Monta o índice na primeira consulta, não na importação do módulo. */
function carregar(): Map<string, MunicipioBrasileiro> {
  if (indice) return indice;
  const mapa = new Map<string, MunicipioBrasileiro>();
  for (const linha of TABELA.split("\n")) {
    if (!linha) continue;
    const [ibge, chave, uf, latitude, longitude] = linha.split("|");
    if (!ibge || !chave || !uf || !latitude || !longitude) continue;
    mapa.set(`${chave}|${uf}`, {
      ibge: Number(ibge),
      chave,
      uf,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }
  indice = mapa;
  return mapa;
}

/** A mesma normalização que gerou a tabela. */
export function chaveDoMunicipio(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Acha o município pelo nome como o portal o escreve, mais a UF. Indefinido
 * quando não casa — caso normal, não erro: o município continua nos totais,
 * só não ganha ponto no mapa.
 */
export function acharMunicipio(
  nome: string | null | undefined,
  uf: string | null | undefined,
): MunicipioBrasileiro | undefined {
  if (!nome || !uf) return undefined;
  return carregar().get(`${chaveDoMunicipio(nome)}|${uf.trim().toUpperCase()}`);
}

/** Quantos municípios a tabela tem. Existe para o teste provar que carregou. */
export function totalDeMunicipios(): number {
  return carregar().size;
}
