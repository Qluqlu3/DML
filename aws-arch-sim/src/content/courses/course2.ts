import { configIs, connected, exists, noDirect, reachable } from '../../engine/rules/predicates';
import type { Course } from '../../learning/types';
import { ACM, ALB, CF, R53, S3, USER, userOnly, WAF } from './shared';

export const course2: Course = {
  id: 'edge',
  title: '配信と DNS',
  description:
    'Route 53 で独自ドメインを使い、CloudFront で世界中に速く届け、WAF と ACM で守る。ユーザーに一番近い「入口」の作り方を学びます。',
  lessons: [
    // ------------------------------------------------------------------
    {
      id: 'edge-1-route53',
      title: 'Route 53 で独自ドメインを使う',
      level: 2,
      summary:
        'コース 1 で作った Web アプリに Route 53 を加え、「shop.example.com」のようなドメイン名でアクセスできるようにします。',
      goals: ['DNS（名前解決）の役割が分かる', 'ヘルスチェックで異常を検知できることが分かる'],
      start: { from: 'lesson', lessonId: 'web-4-db' },
      steps: [
        {
          id: 'route53',
          title: 'Route 53 を入口に加えよう',
          instruction:
            '**Route 53** を VPC の外に置き、**ユーザー → Route 53 → ALB** とつないでください。ユーザーから ALB への直接の線は削除します。',
          introduces: ['route53'],
          highlight: { palette: ['route53'] },
          checkpoints: [
            { id: 'r53', label: 'Route 53 がある', rule: exists(R53) },
            {
              id: 'path',
              label: 'ユーザーから Route 53 を通って ALB に届く',
              rule: reachable(USER, ALB, { via: R53 }),
            },
            { id: 'direct', label: 'ユーザーから ALB へ直接の線がない', rule: noDirect(USER, ALB) },
          ],
          hints: ['線を消すには、線をクリックして Delete キーを押します'],
          answer: [
            { op: 'add', kind: 'route53', name: 'shop.example.com' },
            { op: 'connect', from: USER, to: R53 },
            { op: 'connect', from: R53, to: ALB },
            { op: 'disconnect', from: USER, to: ALB },
          ],
          why: 'ユーザーはまず Route 53 に「shop.example.com はどこ？」と問い合わせ、ALB の場所を教えてもらいます。ALB の IP アドレスは変わることがあるので、ドメイン名で案内するのが基本です（図では DNS の問い合わせ → 接続の流れを 1 本の経路として描きます）。',
        },
        {
          id: 'health',
          title: 'ヘルスチェックを有効にしよう',
          instruction: '**Route 53** を選択し、**ヘルスチェック** を有効にしてください。',
          highlight: { nodes: [R53] },
          checkpoints: [
            {
              id: 'health',
              label: 'Route 53 のヘルスチェックが有効',
              rule: configIs(R53, 'healthCheck', '==', true),
            },
          ],
          hints: ['プロパティのチェックボックスで切り替えます'],
          answer: [{ op: 'config', target: R53, set: { healthCheck: true } }],
          why: 'ヘルスチェックを有効にすると、Route 53 が定期的に宛先を確認し、応答がなければ別の宛先（予備のサイトなど）に案内を切り替えられます（フェイルオーバー）。',
        },
      ],
      quiz: [
        {
          question: 'Route 53 の主な役割は？',
          choices: [
            {
              text: 'ドメイン名を、ALB などの実際の宛先に変換して教える（DNS）',
              correct: true,
              explanation: '電話帳のように、名前から宛先を引けるようにします。',
            },
            {
              text: 'Web ページをキャッシュして速く返す',
              correct: false,
              explanation: 'それは CloudFront の役割です。',
            },
          ],
        },
        {
          question: 'ALB をドメイン名で案内する理由は？',
          choices: [
            {
              text: 'ALB の IP アドレスは変わることがあるから',
              correct: true,
              explanation: 'IP を直接使うと、変わったときにつながらなくなります。',
            },
            {
              text: 'IP アドレスだと料金が高いから',
              correct: false,
              explanation: '料金の問題ではなく、宛先が変わることへの備えです。',
            },
          ],
        },
      ],
      wrapUp:
        'ドメイン名でアクセスできるようになりました。次は、画像や HTML だけのサイトを、サーバーなしで速く安全に配信する方法を学びます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'edge-2-static',
      title: 'S3 と CloudFront で静的サイトを配信',
      level: 2,
      summary:
        'HTML や画像を S3 に置き、CloudFront で配信します。S3 は非公開のまま、CloudFront からだけ読めるようにする（OAC）のがポイントです。',
      goals: ['CloudFront（CDN）の役割が分かる', 'OAC で S3 を非公開のまま配信できる'],
      start: { from: 'document', doc: userOnly() },
      steps: [
        {
          id: 's3',
          title: 'サイトのファイルを置く S3 を用意しよう',
          instruction:
            '**S3** を置いて名前を **サイト** にしてください。「パブリックアクセスをブロック」は **有効のまま** にします。',
          highlight: { palette: ['s3'] },
          checkpoints: [
            { id: 's3', label: 'S3 がある', rule: exists(S3) },
            {
              id: 'block',
              label: 'パブリックアクセスのブロックが有効',
              rule: configIs(S3, 'blockPublicAccess', '==', true),
            },
          ],
          hints: ['S3 は VPC の外に置きます'],
          answer: [{ op: 'add', kind: 's3', name: 'サイト' }],
          why: 'S3 は HTML や画像などの静的ファイルの置き場所にぴったりです。誰でも読める状態にはせず、次のステップの CloudFront からだけ読めるようにします。',
        },
        {
          id: 'cloudfront',
          title: 'CloudFront 経由で配信しよう',
          instruction:
            '**CloudFront** を置き、**ユーザー → CloudFront → S3** とつないでください。ユーザーから S3 へは直接つなぎません。',
          introduces: ['cloudfront'],
          highlight: { palette: ['cloudfront'] },
          checkpoints: [
            {
              id: 'path',
              label: 'ユーザーから CloudFront を通って S3 に届く',
              rule: reachable(USER, S3, { via: CF }),
            },
            {
              id: 'direct',
              label: 'ユーザーから S3 へ直接つながっていない',
              rule: noDirect(USER, S3),
            },
          ],
          hints: ['CloudFront は「エッジ・DNS」グループにあります'],
          answer: [
            { op: 'add', kind: 'cloudfront', name: 'CDN' },
            { op: 'connect', from: USER, to: CF },
            { op: 'connect', from: CF, to: S3 },
          ],
          why: 'CloudFront は世界中にある拠点（エッジ）にファイルをキャッシュし、ユーザーの近くから返します。表示が速くなり、S3 へのアクセスも減ります。',
        },
        {
          id: 'oac',
          title: 'OAC で CloudFront からだけ S3 を読めるようにしよう',
          instruction: '**CloudFront** を選択し、**OAC** を有効にしてください。',
          highlight: { nodes: [CF] },
          checkpoints: [
            { id: 'oac', label: 'CloudFront の OAC が有効', rule: configIs(CF, 'oac', '==', true) },
            {
              id: 'block',
              label: 'S3 は非公開のまま',
              rule: configIs(S3, 'blockPublicAccess', '==', true),
            },
          ],
          hints: [
            'OAC（Origin Access Control）は「この CloudFront からのアクセスだけ許可する」設定です',
          ],
          answer: [{ op: 'config', target: CF, set: { oac: true } }],
          why: 'OAC を使うと、S3 を非公開にしたまま CloudFront からだけ読めるようになります。S3 の URL を直接たたかれてもファイルは見えません。',
          badExample:
            'S3 を公開設定にして配信すると、CloudFront を迂回して直接ダウンロードされたり、設定ミスで非公開のファイルまで見えてしまったりします。',
        },
        {
          id: 'route53',
          title: 'Route 53 でドメインを CloudFront に向けよう',
          instruction:
            '**Route 53** を置き、**ユーザー → Route 53 → CloudFront** とつないでください。ユーザーから CloudFront への直接の線は削除します。',
          highlight: { palette: ['route53'] },
          checkpoints: [
            {
              id: 'path',
              label: 'ユーザーから Route 53 を通って CloudFront に届く',
              rule: reachable(USER, CF, { via: R53 }),
            },
            {
              id: 'direct',
              label: 'ユーザーから CloudFront へ直接の線がない',
              rule: noDirect(USER, CF),
            },
          ],
          hints: ['前のレッスンの ALB と同じ要領です'],
          answer: [
            { op: 'add', kind: 'route53', name: 'www.example.com' },
            { op: 'connect', from: USER, to: R53 },
            { op: 'connect', from: R53, to: CF },
            { op: 'disconnect', from: USER, to: CF },
          ],
          why: 'Route 53 のエイリアスレコードで、独自ドメインを CloudFront に向けます。これでサーバーを 1 台も持たない Web サイトの完成です。',
        },
      ],
      quiz: [
        {
          question:
            'S3 の静的サイトを CloudFront で配信するとき、S3 を非公開のままにするための設定は？',
          choices: [
            {
              text: 'CloudFront の OAC',
              correct: true,
              explanation: 'OAC で CloudFront からのアクセスだけを許可します。',
            },
            {
              text: 'S3 のパブリックアクセスのブロックを解除する',
              correct: false,
              explanation: 'それは S3 を誰でも読める状態にする操作で、逆効果です。',
            },
          ],
        },
        {
          question: 'CloudFront を使うと表示が速くなる理由は？',
          choices: [
            {
              text: 'ユーザーの近くの拠点（エッジ）にキャッシュしたファイルを返すから',
              correct: true,
              explanation: '遠くの S3 まで毎回取りに行かずに済みます。',
            },
            {
              text: 'S3 の保存容量が増えるから',
              correct: false,
              explanation: '容量は速さとは関係ありません。',
            },
          ],
        },
      ],
      wrapUp:
        'サーバーなしで、速く安全な静的サイトを作れました。次は、ALB を使う動的なサイトの前にも CloudFront を置いてみます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'edge-3-dynamic',
      title: '動的なサイトを CloudFront で速くする',
      level: 2,
      summary:
        'ALB の前に CloudFront を置き、画像などの静的ファイルは S3 から、ページは ALB から配信します。1 つの CloudFront から複数の配信元を使い分ける構成です。',
      goals: [
        'CloudFront の配信元（オリジン）に ALB も使えることが分かる',
        '静的ファイルと動的なページで配信元を分けられる',
      ],
      start: { from: 'lesson', lessonId: 'edge-1-route53' },
      steps: [
        {
          id: 'cloudfront',
          title: 'ALB の前に CloudFront を置こう',
          instruction:
            '**CloudFront** を置き、**Route 53 → CloudFront → ALB** とつないでください。Route 53 から ALB への直接の線は削除します。',
          highlight: { palette: ['cloudfront'] },
          checkpoints: [
            {
              id: 'path',
              label: 'ユーザーから CloudFront を通って ALB に届く',
              rule: reachable(USER, ALB, { via: CF }),
            },
            { id: 'direct', label: 'Route 53 から ALB へ直接の線がない', rule: noDirect(R53, ALB) },
          ],
          hints: ['CloudFront の配信元（オリジン）には S3 だけでなく ALB も指定できます'],
          answer: [
            { op: 'add', kind: 'cloudfront', name: 'CDN' },
            { op: 'connect', from: R53, to: CF },
            { op: 'connect', from: CF, to: ALB },
            { op: 'disconnect', from: R53, to: ALB },
          ],
          why: 'CloudFront はキャッシュしないページでも、世界中のエッジから AWS のネットワークを通って ALB に届けるので、遠いユーザーの通信が安定します。キャッシュできる部分は CloudFront が返すので、サーバーの負荷も減ります。',
        },
        {
          id: 'static',
          title: '画像などの静的ファイルは S3 から配信しよう',
          instruction:
            '**S3** を置いて名前を **静的ファイル** にし、**CloudFront → S3** とつないでください。CloudFront の **OAC** も有効にします。',
          highlight: { palette: ['s3'] },
          checkpoints: [
            { id: 'cf-s3', label: 'CloudFront から S3 への接続がある', rule: connected(CF, S3) },
            { id: 'oac', label: 'CloudFront の OAC が有効', rule: configIs(CF, 'oac', '==', true) },
          ],
          hints: ['1 つの CloudFront に、配信元を複数つなげられます'],
          answer: [
            { op: 'add', kind: 's3', name: '静的ファイル' },
            { op: 'connect', from: CF, to: S3 },
            { op: 'config', target: CF, set: { oac: true } },
          ],
          why: '「/images/* は S3、それ以外は ALB」のように、URL のパスで配信元を分けられます。画像や CSS をサーバーから切り離すと、EC2 は動的な処理だけに集中できます。',
        },
      ],
      quiz: [
        {
          question: '1 つの CloudFront で S3 と ALB の両方を配信元にする利点は？',
          choices: [
            {
              text: '静的ファイルは S3、動的なページは ALB と分けて、サーバーの負荷を減らせる',
              correct: true,
              explanation: 'パスごとに配信元を使い分けるのは定番の構成です。',
            },
            {
              text: 'ALB が不要になる',
              correct: false,
              explanation: '動的なページは引き続き ALB と EC2 が処理します。',
            },
          ],
        },
        {
          question: 'CloudFront の配信元（オリジン）として使えるものは？',
          choices: [
            {
              text: 'S3 も ALB も使える',
              correct: true,
              explanation: 'API Gateway や独自のサーバーも配信元にできます。',
            },
            {
              text: 'S3 だけ',
              correct: false,
              explanation: 'S3 以外も配信元にできます。',
            },
          ],
        },
      ],
      wrapUp:
        '動的なサイトも CloudFront で配信できるようになりました。入口が CloudFront にまとまったので、次はここで攻撃をまとめて防ぎます。',
    },
    // ------------------------------------------------------------------
    {
      id: 'edge-4-waf',
      title: 'WAF で攻撃から守る',
      level: 2,
      summary:
        'CloudFront の前段に WAF を置き、よくある攻撃（SQL インジェクションなど）と、大量アクセスをまとめて防ぎます。',
      goals: ['WAF が防ぐ攻撃の種類が分かる', 'マネージドルールとレートベースルールの違いが分かる'],
      start: { from: 'lesson', lessonId: 'edge-3-dynamic' },
      steps: [
        {
          id: 'waf',
          title: 'CloudFront の前に WAF を置こう',
          instruction:
            '**AWS WAF** を置き、**Route 53 → WAF → CloudFront** とつないでください。Route 53 から CloudFront への直接の線は削除します。',
          introduces: ['waf'],
          highlight: { palette: ['waf'] },
          checkpoints: [
            {
              id: 'path',
              label: 'ユーザーから WAF を通って CloudFront に届く',
              rule: reachable(USER, CF, { via: WAF }),
            },
            {
              id: 'direct',
              label: 'Route 53 から CloudFront へ直接の線がない',
              rule: noDirect(R53, CF),
            },
          ],
          hints: [
            '実際の WAF は CloudFront に「取り付ける」ものですが、図では通信の前段として描くと分かりやすくなります',
          ],
          answer: [
            { op: 'add', kind: 'waf', name: 'WAF' },
            { op: 'connect', from: R53, to: WAF },
            { op: 'connect', from: WAF, to: CF },
            { op: 'disconnect', from: R53, to: CF },
          ],
          why: 'WAF はリクエストの中身を見て、SQL インジェクションやクロスサイトスクリプティングなどの攻撃を止めます。入口の CloudFront に付ければ、後ろのすべてのサーバーをまとめて守れます。',
        },
        {
          id: 'rules',
          title: 'マネージドルールとレートベースルールの両方を使おう',
          instruction: '**WAF** を選択し、ルールを **マネージド + レートベース** にしてください。',
          highlight: { nodes: [WAF] },
          checkpoints: [
            {
              id: 'both',
              label: 'マネージドとレートベースの両方を使う',
              rule: configIs(WAF, 'ruleSet', '==', 'both'),
            },
          ],
          hints: ['マネージドルールは攻撃パターン、レートベースはアクセスの多さで判断します'],
          answer: [{ op: 'config', target: WAF, set: { ruleSet: 'both' } }],
          why: 'マネージドルールは AWS などが用意した攻撃パターンの一覧で、よくある攻撃をすぐに防げます。レートベースルールは「同じ IP から 5 分に 1000 回以上」のような大量アクセスを止め、ログイン画面への総当たりなどを防ぎます。',
          badExample:
            'WAF がないと、よく知られた攻撃でもアプリの脆弱性に直接届き、情報漏えいにつながることがあります。',
        },
      ],
      quiz: [
        {
          question: 'WAF のレートベースルールが特に役立つ場面は？',
          choices: [
            {
              text: '同じ相手からの大量のリクエスト（総当たり攻撃など）を止めたいとき',
              correct: true,
              explanation: '一定時間あたりのリクエスト数が上限を超えた相手をブロックします。',
            },
            {
              text: 'サイトの表示を速くしたいとき',
              correct: false,
              explanation: '表示を速くするのは CloudFront のキャッシュです。',
            },
          ],
        },
        {
          question: 'WAF を取り付けられるものは？',
          choices: [
            {
              text: 'CloudFront・ALB・API Gateway など',
              correct: true,
              explanation: 'HTTP のリクエストを受ける入口に取り付けます。',
            },
            {
              text: 'RDS',
              correct: false,
              explanation: 'DB には取り付けられません。DB は SG とサブネットで守ります。',
            },
          ],
        },
      ],
      wrapUp:
        'WAF で入口を守れるようになりました。最後に、通信を暗号化する HTTPS の証明書を用意します。',
    },
    // ------------------------------------------------------------------
    {
      id: 'edge-5-acm',
      title: 'ACM の証明書で HTTPS 化する',
      level: 2,
      summary:
        'ACM で無料の証明書を発行し、CloudFront と ALB に取り付けて、通信を HTTPS で暗号化します。',
      goals: [
        'HTTPS に証明書が必要な理由が分かる',
        'ACM の証明書を CloudFront と ALB に付けられる',
      ],
      start: { from: 'lesson', lessonId: 'edge-4-waf' },
      steps: [
        {
          id: 'acm',
          title: 'ACM の証明書を CloudFront と ALB に付けよう',
          instruction:
            '**Certificate Manager** を置き、**ACM → CloudFront** と **ACM → ALB** をつないでください（矢印は証明書の提供先です）。',
          introduces: ['acm'],
          highlight: { palette: ['acm'] },
          checkpoints: [
            { id: 'cf', label: 'CloudFront に証明書がある', rule: connected(ACM, CF) },
            { id: 'alb', label: 'ALB に証明書がある', rule: connected(ACM, ALB) },
          ],
          hints: ['CloudFront 用の証明書は、バージニア北部（us-east-1）で発行する決まりがあります'],
          answer: [
            { op: 'add', kind: 'acm', name: '証明書' },
            { op: 'connect', from: ACM, to: CF },
            { op: 'connect', from: ACM, to: ALB },
          ],
          why: 'HTTPS では、サーバーが「本物の shop.example.com です」と証明書で示し、通信を暗号化します。ユーザー ↔ CloudFront と CloudFront ↔ ALB の両方を HTTPS にすれば、経路の途中で盗み見されません。',
          badExample:
            'HTTP のままだと、パスワードやカード番号が途中のネットワークで読み取られる危険があり、ブラウザにも「保護されていない通信」と表示されます。',
        },
        {
          id: 'domain',
          title: '証明書のドメインをサイトに合わせよう',
          instruction:
            '**Certificate Manager** を選択し、ドメインを **shop.example.com** にしてください。',
          highlight: { nodes: [ACM] },
          checkpoints: [
            {
              id: 'domain',
              label: '証明書のドメインが shop.example.com',
              rule: configIs(ACM, 'domain', '==', 'shop.example.com'),
            },
          ],
          hints: ['証明書のドメインと、ユーザーがアクセスするドメインが一致している必要があります'],
          answer: [{ op: 'config', target: ACM, set: { domain: 'shop.example.com' } }],
          why: '証明書は特定のドメインに対して発行されます。アクセスするドメインと違うと、ブラウザが警告を出して接続を止めます。DNS 検証にしておけば、更新も自動で行われます。',
        },
      ],
      quiz: [
        {
          question: 'CloudFront で使う ACM の証明書を発行するリージョンは？',
          choices: [
            {
              text: 'バージニア北部（us-east-1）',
              correct: true,
              explanation:
                'CloudFront はグローバルなサービスのため、証明書は us-east-1 のものを使う決まりです。',
            },
            {
              text: '東京（ap-northeast-1）',
              correct: false,
              explanation:
                '東京で発行した証明書は ALB には使えますが、CloudFront では選べません。よくある落とし穴です。',
            },
          ],
        },
        {
          question: 'ACM の公開証明書の料金は？',
          choices: [
            {
              text: 'ALB や CloudFront で使う分は無料',
              correct: true,
              explanation: '無料で、更新も自動です。',
            },
            {
              text: '1 枚ごとに年額がかかる',
              correct: false,
              explanation: 'ACM の公開証明書は無料です。',
            },
          ],
        },
      ],
      wrapUp:
        'コース 2 は完了です。Route 53・CloudFront・WAF・ACM で、速くて安全な入口ができました。次のコースでは、サーバーを持たない「サーバーレス」な構成を学びます。',
    },
  ],
};
