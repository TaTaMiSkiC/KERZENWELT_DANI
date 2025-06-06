PGDMP  )    !                }            neondb    16.9    16.5 �               0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                      false                       0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                      false                       0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                      false                       1262    16389    neondb    DATABASE     n   CREATE DATABASE neondb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';
    DROP DATABASE neondb;
                neondb_owner    false            �            1259    41077 
   cart_items    TABLE     '  CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    scent_id integer,
    color_id integer,
    color_name text,
    color_ids text,
    has_multiple_colors boolean DEFAULT false NOT NULL
);
    DROP TABLE public.cart_items;
       public         heap    neondb_owner    false            �            1259    41076    cart_items_id_seq    SEQUENCE     �   CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.cart_items_id_seq;
       public          neondb_owner    false    232                       0    0    cart_items_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;
          public          neondb_owner    false    231            �            1259    41024 
   categories    TABLE     ~   CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    image_url text
);
    DROP TABLE public.categories;
       public         heap    neondb_owner    false            �            1259    41023    categories_id_seq    SEQUENCE     �   CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.categories_id_seq;
       public          neondb_owner    false    222                       0    0    categories_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;
          public          neondb_owner    false    221            �            1259    41137    collections    TABLE     m  CREATE TABLE public.collections (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text,
    featured_on_home boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.collections;
       public         heap    neondb_owner    false            �            1259    41136    collections_id_seq    SEQUENCE     �   CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.collections_id_seq;
       public          neondb_owner    false    244                       0    0    collections_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;
          public          neondb_owner    false    243            �            1259    41043    colors    TABLE     �   CREATE TABLE public.colors (
    id integer NOT NULL,
    name text NOT NULL,
    hex_value text NOT NULL,
    active boolean DEFAULT true NOT NULL
);
    DROP TABLE public.colors;
       public         heap    neondb_owner    false            �            1259    41042    colors_id_seq    SEQUENCE     �   CREATE SEQUENCE public.colors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 $   DROP SEQUENCE public.colors_id_seq;
       public          neondb_owner    false    226                       0    0    colors_id_seq    SEQUENCE OWNED BY     ?   ALTER SEQUENCE public.colors_id_seq OWNED BY public.colors.id;
          public          neondb_owner    false    225                       1259    57345    company_documents    TABLE     f  CREATE TABLE public.company_documents (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    file_url text NOT NULL,
    file_type text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_size bigint,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
 %   DROP TABLE public.company_documents;
       public         heap    neondb_owner    false                        1259    57344    company_documents_id_seq    SEQUENCE     �   CREATE SEQUENCE public.company_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 /   DROP SEQUENCE public.company_documents_id_seq;
       public          neondb_owner    false    257                       0    0    company_documents_id_seq    SEQUENCE OWNED BY     U   ALTER SEQUENCE public.company_documents_id_seq OWNED BY public.company_documents.id;
          public          neondb_owner    false    256            �            1259    41167    invoice_items    TABLE     S  CREATE TABLE public.invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    price character varying(255) NOT NULL,
    selected_scent character varying(255),
    selected_color character varying(255)
);
 !   DROP TABLE public.invoice_items;
       public         heap    neondb_owner    false            �            1259    41166    invoice_items_id_seq    SEQUENCE     �   CREATE SEQUENCE public.invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 +   DROP SEQUENCE public.invoice_items_id_seq;
       public          neondb_owner    false    250                       0    0    invoice_items_id_seq    SEQUENCE OWNED BY     M   ALTER SEQUENCE public.invoice_items_id_seq OWNED BY public.invoice_items.id;
          public          neondb_owner    false    249            �            1259    41157    invoices    TABLE     �  CREATE TABLE public.invoices (
    id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    order_id integer,
    invoice_number character varying(255) NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_address character varying(255),
    customer_city character varying(255),
    customer_postal_code character varying(255),
    customer_country character varying(255),
    customer_phone character varying(255),
    subtotal character varying(255) NOT NULL,
    tax character varying(255) NOT NULL,
    total character varying(255) NOT NULL,
    language character varying(255) NOT NULL,
    customer_note character varying,
    payment_method character varying,
    discount_amount numeric(10,2) DEFAULT 0,
    discount_type text DEFAULT 'fixed'::text,
    discount_percentage numeric(5,2) DEFAULT 0
);
    DROP TABLE public.invoices;
       public         heap    neondb_owner    false            �            1259    41156    invoices_id_seq    SEQUENCE     �   CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 &   DROP SEQUENCE public.invoices_id_seq;
       public          neondb_owner    false    248                       0    0    invoices_id_seq    SEQUENCE OWNED BY     C   ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;
          public          neondb_owner    false    247            �            1259    41067    order_items    TABLE     w  CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    scent_id integer,
    scent_name text,
    color_id integer,
    color_name text,
    color_ids text,
    has_multiple_colors boolean DEFAULT false NOT NULL
);
    DROP TABLE public.order_items;
       public         heap    neondb_owner    false            �            1259    41066    order_items_id_seq    SEQUENCE     �   CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.order_items_id_seq;
       public          neondb_owner    false    230                       0    0    order_items_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;
          public          neondb_owner    false    229            �            1259    41053    orders    TABLE     �  CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total numeric(10,2) NOT NULL,
    subtotal numeric(10,2),
    discount_amount numeric(10,2) DEFAULT 0,
    shipping_cost numeric(10,2) DEFAULT 0,
    payment_method text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    customer_note text,
    shipping_address text,
    shipping_city text,
    shipping_postal_code text,
    shipping_country text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    discount_type text DEFAULT 'fixed'::text,
    discount_percentage numeric(5,2) DEFAULT 0
);
    DROP TABLE public.orders;
       public         heap    neondb_owner    false            �            1259    41052    orders_id_seq    SEQUENCE     �   CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 $   DROP SEQUENCE public.orders_id_seq;
       public          neondb_owner    false    228                       0    0    orders_id_seq    SEQUENCE OWNED BY     ?   ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;
          public          neondb_owner    false    227            �            1259    41176    page_visits    TABLE       CREATE TABLE public.page_visits (
    id integer NOT NULL,
    path text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    last_visited timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.page_visits;
       public         heap    neondb_owner    false            �            1259    41175    page_visits_id_seq    SEQUENCE     �   CREATE SEQUENCE public.page_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.page_visits_id_seq;
       public          neondb_owner    false    252                       0    0    page_visits_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.page_visits_id_seq OWNED BY public.page_visits.id;
          public          neondb_owner    false    251            �            1259    41124    pages    TABLE     	  CREATE TABLE public.pages (
    id integer NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.pages;
       public         heap    neondb_owner    false            �            1259    41123    pages_id_seq    SEQUENCE     �   CREATE SEQUENCE public.pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 #   DROP SEQUENCE public.pages_id_seq;
       public          neondb_owner    false    242                       0    0    pages_id_seq    SEQUENCE OWNED BY     =   ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;
          public          neondb_owner    false    241            �            1259    41150    product_collections    TABLE     �   CREATE TABLE public.product_collections (
    id integer NOT NULL,
    product_id integer NOT NULL,
    collection_id integer NOT NULL
);
 '   DROP TABLE public.product_collections;
       public         heap    neondb_owner    false            �            1259    41149    product_collections_id_seq    SEQUENCE     �   CREATE SEQUENCE public.product_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 1   DROP SEQUENCE public.product_collections_id_seq;
       public          neondb_owner    false    246                       0    0    product_collections_id_seq    SEQUENCE OWNED BY     Y   ALTER SEQUENCE public.product_collections_id_seq OWNED BY public.product_collections.id;
          public          neondb_owner    false    245            �            1259    41094    product_colors    TABLE     �   CREATE TABLE public.product_colors (
    id integer NOT NULL,
    product_id integer NOT NULL,
    color_id integer NOT NULL
);
 "   DROP TABLE public.product_colors;
       public         heap    neondb_owner    false            �            1259    41093    product_colors_id_seq    SEQUENCE     �   CREATE SEQUENCE public.product_colors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 ,   DROP SEQUENCE public.product_colors_id_seq;
       public          neondb_owner    false    236                       0    0    product_colors_id_seq    SEQUENCE OWNED BY     O   ALTER SEQUENCE public.product_colors_id_seq OWNED BY public.product_colors.id;
          public          neondb_owner    false    235            �            1259    41087    product_scents    TABLE     �   CREATE TABLE public.product_scents (
    id integer NOT NULL,
    product_id integer NOT NULL,
    scent_id integer NOT NULL
);
 "   DROP TABLE public.product_scents;
       public         heap    neondb_owner    false            �            1259    41086    product_scents_id_seq    SEQUENCE     �   CREATE SEQUENCE public.product_scents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 ,   DROP SEQUENCE public.product_scents_id_seq;
       public          neondb_owner    false    234                        0    0    product_scents_id_seq    SEQUENCE OWNED BY     O   ALTER SEQUENCE public.product_scents_id_seq OWNED BY public.product_scents.id;
          public          neondb_owner    false    233            �            1259    41009    products    TABLE     �  CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    image_url text,
    category_id integer,
    stock integer DEFAULT 0 NOT NULL,
    scent text,
    color text,
    burn_time text,
    featured boolean DEFAULT false NOT NULL,
    has_color_options boolean DEFAULT true NOT NULL,
    allow_multiple_colors boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    dimensions text,
    weight text,
    materials text,
    instructions text,
    maintenance text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.products;
       public         heap    neondb_owner    false            �            1259    41008    products_id_seq    SEQUENCE     �   CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 &   DROP SEQUENCE public.products_id_seq;
       public          neondb_owner    false    220            !           0    0    products_id_seq    SEQUENCE OWNED BY     C   ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;
          public          neondb_owner    false    219            �            1259    41101    reviews    TABLE     �   CREATE TABLE public.reviews (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.reviews;
       public         heap    neondb_owner    false            �            1259    41100    reviews_id_seq    SEQUENCE     �   CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 %   DROP SEQUENCE public.reviews_id_seq;
       public          neondb_owner    false    238            "           0    0    reviews_id_seq    SEQUENCE OWNED BY     A   ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;
          public          neondb_owner    false    237            �            1259    41033    scents    TABLE     �   CREATE TABLE public.scents (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL
);
    DROP TABLE public.scents;
       public         heap    neondb_owner    false            �            1259    41032    scents_id_seq    SEQUENCE     �   CREATE SEQUENCE public.scents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 $   DROP SEQUENCE public.scents_id_seq;
       public          neondb_owner    false    224            #           0    0    scents_id_seq    SEQUENCE OWNED BY     ?   ALTER SEQUENCE public.scents_id_seq OWNED BY public.scents.id;
          public          neondb_owner    false    223            �            1259    41204    session    TABLE     �   CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);
    DROP TABLE public.session;
       public         heap    neondb_owner    false            �            1259    41111    settings    TABLE     �   CREATE TABLE public.settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
    DROP TABLE public.settings;
       public         heap    neondb_owner    false            �            1259    41110    settings_id_seq    SEQUENCE     �   CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 &   DROP SEQUENCE public.settings_id_seq;
       public          neondb_owner    false    240            $           0    0    settings_id_seq    SEQUENCE OWNED BY     C   ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;
          public          neondb_owner    false    239            �            1259    41190 
   subscriber    TABLE       CREATE TABLE public.subscriber (
    id integer NOT NULL,
    email text NOT NULL,
    discount_code text NOT NULL,
    discount_used boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    language text DEFAULT 'de'::text NOT NULL
);
    DROP TABLE public.subscriber;
       public         heap    neondb_owner    false            �            1259    41189    subscriber_id_seq    SEQUENCE     �   CREATE SEQUENCE public.subscriber_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.subscriber_id_seq;
       public          neondb_owner    false    254            %           0    0    subscriber_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.subscriber_id_seq OWNED BY public.subscriber.id;
          public          neondb_owner    false    253            �            1259    40979    users    TABLE     �  CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    address text,
    city text,
    postal_code text,
    country text,
    phone text,
    is_admin boolean DEFAULT false NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    discount_minimum_order numeric(10,2) DEFAULT 0,
    discount_expiry_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    discount_type text DEFAULT 'fixed'::text,
    discount_balance numeric(10,2) DEFAULT 0,
    discount_usage_type text DEFAULT 'permanent'::text
);
    DROP TABLE public.users;
       public         heap    neondb_owner    false            �            1259    40978    users_id_seq    SEQUENCE     �   CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 #   DROP SEQUENCE public.users_id_seq;
       public          neondb_owner    false    216            &           0    0    users_id_seq    SEQUENCE OWNED BY     =   ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
          public          neondb_owner    false    215            �            1259    40997    verification_tokens    TABLE     �   CREATE TABLE public.verification_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
 '   DROP TABLE public.verification_tokens;
       public         heap    neondb_owner    false            �            1259    40996    verification_tokens_id_seq    SEQUENCE     �   CREATE SEQUENCE public.verification_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 1   DROP SEQUENCE public.verification_tokens_id_seq;
       public          neondb_owner    false    218            '           0    0    verification_tokens_id_seq    SEQUENCE OWNED BY     Y   ALTER SEQUENCE public.verification_tokens_id_seq OWNED BY public.verification_tokens.id;
          public          neondb_owner    false    217            �           2604    41080    cart_items id    DEFAULT     n   ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);
 <   ALTER TABLE public.cart_items ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    231    232    232            �           2604    41027    categories id    DEFAULT     n   ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);
 <   ALTER TABLE public.categories ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    221    222    222                       2604    41140    collections id    DEFAULT     p   ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);
 =   ALTER TABLE public.collections ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    243    244    244            �           2604    41046 	   colors id    DEFAULT     f   ALTER TABLE ONLY public.colors ALTER COLUMN id SET DEFAULT nextval('public.colors_id_seq'::regclass);
 8   ALTER TABLE public.colors ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    225    226    226                       2604    57348    company_documents id    DEFAULT     |   ALTER TABLE ONLY public.company_documents ALTER COLUMN id SET DEFAULT nextval('public.company_documents_id_seq'::regclass);
 C   ALTER TABLE public.company_documents ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    256    257    257                       2604    41170    invoice_items id    DEFAULT     t   ALTER TABLE ONLY public.invoice_items ALTER COLUMN id SET DEFAULT nextval('public.invoice_items_id_seq'::regclass);
 ?   ALTER TABLE public.invoice_items ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    249    250    250                       2604    41160    invoices id    DEFAULT     j   ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);
 :   ALTER TABLE public.invoices ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    248    247    248            �           2604    41070    order_items id    DEFAULT     p   ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);
 =   ALTER TABLE public.order_items ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    229    230    230            �           2604    41056 	   orders id    DEFAULT     f   ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);
 8   ALTER TABLE public.orders ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    228    227    228                       2604    41179    page_visits id    DEFAULT     p   ALTER TABLE ONLY public.page_visits ALTER COLUMN id SET DEFAULT nextval('public.page_visits_id_seq'::regclass);
 =   ALTER TABLE public.page_visits ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    252    251    252            �           2604    41127    pages id    DEFAULT     d   ALTER TABLE ONLY public.pages ALTER COLUMN id SET DEFAULT nextval('public.pages_id_seq'::regclass);
 7   ALTER TABLE public.pages ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    242    241    242                       2604    41153    product_collections id    DEFAULT     �   ALTER TABLE ONLY public.product_collections ALTER COLUMN id SET DEFAULT nextval('public.product_collections_id_seq'::regclass);
 E   ALTER TABLE public.product_collections ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    245    246    246            �           2604    41097    product_colors id    DEFAULT     v   ALTER TABLE ONLY public.product_colors ALTER COLUMN id SET DEFAULT nextval('public.product_colors_id_seq'::regclass);
 @   ALTER TABLE public.product_colors ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    236    235    236            �           2604    41090    product_scents id    DEFAULT     v   ALTER TABLE ONLY public.product_scents ALTER COLUMN id SET DEFAULT nextval('public.product_scents_id_seq'::regclass);
 @   ALTER TABLE public.product_scents ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    234    233    234            �           2604    41012    products id    DEFAULT     j   ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
 :   ALTER TABLE public.products ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    219    220    220            �           2604    41104 
   reviews id    DEFAULT     h   ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);
 9   ALTER TABLE public.reviews ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    237    238    238            �           2604    41036 	   scents id    DEFAULT     f   ALTER TABLE ONLY public.scents ALTER COLUMN id SET DEFAULT nextval('public.scents_id_seq'::regclass);
 8   ALTER TABLE public.scents ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    224    223    224            �           2604    41114    settings id    DEFAULT     j   ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);
 :   ALTER TABLE public.settings ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    239    240    240                       2604    41193    subscriber id    DEFAULT     n   ALTER TABLE ONLY public.subscriber ALTER COLUMN id SET DEFAULT nextval('public.subscriber_id_seq'::regclass);
 <   ALTER TABLE public.subscriber ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    254    253    254            �           2604    40982    users id    DEFAULT     d   ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
 7   ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    215    216    216            �           2604    41000    verification_tokens id    DEFAULT     �   ALTER TABLE ONLY public.verification_tokens ALTER COLUMN id SET DEFAULT nextval('public.verification_tokens_id_seq'::regclass);
 E   ALTER TABLE public.verification_tokens ALTER COLUMN id DROP DEFAULT;
       public          neondb_owner    false    217    218    218            �          0    41077 
   cart_items 
   TABLE DATA           �   COPY public.cart_items (id, user_id, product_id, quantity, scent_id, color_id, color_name, color_ids, has_multiple_colors) FROM stdin;
    public          neondb_owner    false    232   M�       �          0    41024 
   categories 
   TABLE DATA           F   COPY public.categories (id, name, description, image_url) FROM stdin;
    public          neondb_owner    false    222   j�       �          0    41137    collections 
   TABLE DATA           y   COPY public.collections (id, name, description, image_url, featured_on_home, active, created_at, updated_at) FROM stdin;
    public          neondb_owner    false    244   c�       �          0    41043    colors 
   TABLE DATA           =   COPY public.colors (id, name, hex_value, active) FROM stdin;
    public          neondb_owner    false    226   �                 0    57345    company_documents 
   TABLE DATA           �   COPY public.company_documents (id, name, description, file_url, file_type, created_at, file_size, uploaded_by, uploaded_at) FROM stdin;
    public          neondb_owner    false    257   7�                 0    41167    invoice_items 
   TABLE DATA           �   COPY public.invoice_items (id, invoice_id, product_id, product_name, quantity, price, selected_scent, selected_color) FROM stdin;
    public          neondb_owner    false    250   �                 0    41157    invoices 
   TABLE DATA           A  COPY public.invoices (id, user_id, created_at, order_id, invoice_number, customer_name, customer_email, customer_address, customer_city, customer_postal_code, customer_country, customer_phone, subtotal, tax, total, language, customer_note, payment_method, discount_amount, discount_type, discount_percentage) FROM stdin;
    public          neondb_owner    false    248   :�       �          0    41067    order_items 
   TABLE DATA           �   COPY public.order_items (id, order_id, product_id, product_name, quantity, price, scent_id, scent_name, color_id, color_name, color_ids, has_multiple_colors) FROM stdin;
    public          neondb_owner    false    230   �       �          0    41053    orders 
   TABLE DATA             COPY public.orders (id, user_id, status, total, subtotal, discount_amount, shipping_cost, payment_method, payment_status, customer_note, shipping_address, shipping_city, shipping_postal_code, shipping_country, created_at, discount_type, discount_percentage) FROM stdin;
    public          neondb_owner    false    228   �                 0    41176    page_visits 
   TABLE DATA           P   COPY public.page_visits (id, path, count, last_visited, created_at) FROM stdin;
    public          neondb_owner    false    252   v�       �          0    41124    pages 
   TABLE DATA           Q   COPY public.pages (id, type, title, content, created_at, updated_at) FROM stdin;
    public          neondb_owner    false    242   �                 0    41150    product_collections 
   TABLE DATA           L   COPY public.product_collections (id, product_id, collection_id) FROM stdin;
    public          neondb_owner    false    246   �       �          0    41094    product_colors 
   TABLE DATA           B   COPY public.product_colors (id, product_id, color_id) FROM stdin;
    public          neondb_owner    false    236   -�       �          0    41087    product_scents 
   TABLE DATA           B   COPY public.product_scents (id, product_id, scent_id) FROM stdin;
    public          neondb_owner    false    234   6�       �          0    41009    products 
   TABLE DATA           �   COPY public.products (id, name, description, price, image_url, category_id, stock, scent, color, burn_time, featured, has_color_options, allow_multiple_colors, active, dimensions, weight, materials, instructions, maintenance, created_at) FROM stdin;
    public          neondb_owner    false    220   N�       �          0    41101    reviews 
   TABLE DATA           W   COPY public.reviews (id, user_id, product_id, rating, comment, created_at) FROM stdin;
    public          neondb_owner    false    238   �       �          0    41033    scents 
   TABLE DATA           ?   COPY public.scents (id, name, description, active) FROM stdin;
    public          neondb_owner    false    224   �       
          0    41204    session 
   TABLE DATA           4   COPY public.session (sid, sess, expire) FROM stdin;
    public          neondb_owner    false    255   ~�       �          0    41111    settings 
   TABLE DATA           J   COPY public.settings (id, key, value, created_at, updated_at) FROM stdin;
    public          neondb_owner    false    240   �       	          0    41190 
   subscriber 
   TABLE DATA           c   COPY public.subscriber (id, email, discount_code, discount_used, created_at, language) FROM stdin;
    public          neondb_owner    false    254   u�       �          0    40979    users 
   TABLE DATA             COPY public.users (id, username, password, email, first_name, last_name, address, city, postal_code, country, phone, is_admin, email_verified, discount_amount, discount_minimum_order, discount_expiry_date, created_at, discount_type, discount_balance, discount_usage_type) FROM stdin;
    public          neondb_owner    false    216   �       �          0    40997    verification_tokens 
   TABLE DATA           Y   COPY public.verification_tokens (id, user_id, token, expires_at, created_at) FROM stdin;
    public          neondb_owner    false    218   �       (           0    0    cart_items_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.cart_items_id_seq', 88, true);
          public          neondb_owner    false    231            )           0    0    categories_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.categories_id_seq', 13, true);
          public          neondb_owner    false    221            *           0    0    collections_id_seq    SEQUENCE SET     A   SELECT pg_catalog.setval('public.collections_id_seq', 1, false);
          public          neondb_owner    false    243            +           0    0    colors_id_seq    SEQUENCE SET     <   SELECT pg_catalog.setval('public.colors_id_seq', 15, true);
          public          neondb_owner    false    225            ,           0    0    company_documents_id_seq    SEQUENCE SET     F   SELECT pg_catalog.setval('public.company_documents_id_seq', 2, true);
          public          neondb_owner    false    256            -           0    0    invoice_items_id_seq    SEQUENCE SET     C   SELECT pg_catalog.setval('public.invoice_items_id_seq', 45, true);
          public          neondb_owner    false    249            .           0    0    invoices_id_seq    SEQUENCE SET     >   SELECT pg_catalog.setval('public.invoices_id_seq', 51, true);
          public          neondb_owner    false    247            /           0    0    order_items_id_seq    SEQUENCE SET     A   SELECT pg_catalog.setval('public.order_items_id_seq', 76, true);
          public          neondb_owner    false    229            0           0    0    orders_id_seq    SEQUENCE SET     <   SELECT pg_catalog.setval('public.orders_id_seq', 88, true);
          public          neondb_owner    false    227            1           0    0    page_visits_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.page_visits_id_seq', 2, true);
          public          neondb_owner    false    251            2           0    0    pages_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.pages_id_seq', 2, true);
          public          neondb_owner    false    241            3           0    0    product_collections_id_seq    SEQUENCE SET     I   SELECT pg_catalog.setval('public.product_collections_id_seq', 1, false);
          public          neondb_owner    false    245            4           0    0    product_colors_id_seq    SEQUENCE SET     E   SELECT pg_catalog.setval('public.product_colors_id_seq', 570, true);
          public          neondb_owner    false    235            5           0    0    product_scents_id_seq    SEQUENCE SET     E   SELECT pg_catalog.setval('public.product_scents_id_seq', 785, true);
          public          neondb_owner    false    233            6           0    0    products_id_seq    SEQUENCE SET     >   SELECT pg_catalog.setval('public.products_id_seq', 15, true);
          public          neondb_owner    false    219            7           0    0    reviews_id_seq    SEQUENCE SET     =   SELECT pg_catalog.setval('public.reviews_id_seq', 1, false);
          public          neondb_owner    false    237            8           0    0    scents_id_seq    SEQUENCE SET     <   SELECT pg_catalog.setval('public.scents_id_seq', 15, true);
          public          neondb_owner    false    223            9           0    0    settings_id_seq    SEQUENCE SET     >   SELECT pg_catalog.setval('public.settings_id_seq', 20, true);
          public          neondb_owner    false    239            :           0    0    subscriber_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.subscriber_id_seq', 11, true);
          public          neondb_owner    false    253            ;           0    0    users_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.users_id_seq', 8, true);
          public          neondb_owner    false    215            <           0    0    verification_tokens_id_seq    SEQUENCE SET     H   SELECT pg_catalog.setval('public.verification_tokens_id_seq', 4, true);
          public          neondb_owner    false    217            /           2606    41085    cart_items cart_items_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.cart_items DROP CONSTRAINT cart_items_pkey;
       public            neondb_owner    false    232            %           2606    41031    categories categories_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.categories DROP CONSTRAINT categories_pkey;
       public            neondb_owner    false    222            ?           2606    41148    collections collections_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.collections DROP CONSTRAINT collections_pkey;
       public            neondb_owner    false    244            )           2606    41051    colors colors_pkey 
   CONSTRAINT     P   ALTER TABLE ONLY public.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);
 <   ALTER TABLE ONLY public.colors DROP CONSTRAINT colors_pkey;
       public            neondb_owner    false    226            R           2606    57353 (   company_documents company_documents_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.company_documents
    ADD CONSTRAINT company_documents_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.company_documents DROP CONSTRAINT company_documents_pkey;
       public            neondb_owner    false    257            E           2606    41174     invoice_items invoice_items_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.invoice_items DROP CONSTRAINT invoice_items_pkey;
       public            neondb_owner    false    250            C           2606    41165    invoices invoices_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.invoices DROP CONSTRAINT invoices_pkey;
       public            neondb_owner    false    248            -           2606    41075    order_items order_items_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.order_items DROP CONSTRAINT order_items_pkey;
       public            neondb_owner    false    230            +           2606    41065    orders orders_pkey 
   CONSTRAINT     P   ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
 <   ALTER TABLE ONLY public.orders DROP CONSTRAINT orders_pkey;
       public            neondb_owner    false    228            G           2606    41188     page_visits page_visits_path_key 
   CONSTRAINT     [   ALTER TABLE ONLY public.page_visits
    ADD CONSTRAINT page_visits_path_key UNIQUE (path);
 J   ALTER TABLE ONLY public.page_visits DROP CONSTRAINT page_visits_path_key;
       public            neondb_owner    false    252            I           2606    41186    page_visits page_visits_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.page_visits
    ADD CONSTRAINT page_visits_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.page_visits DROP CONSTRAINT page_visits_pkey;
       public            neondb_owner    false    252            ;           2606    41133    pages pages_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.pages DROP CONSTRAINT pages_pkey;
       public            neondb_owner    false    242            =           2606    41135    pages pages_type_key 
   CONSTRAINT     O   ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_type_key UNIQUE (type);
 >   ALTER TABLE ONLY public.pages DROP CONSTRAINT pages_type_key;
       public            neondb_owner    false    242            A           2606    41155 ,   product_collections product_collections_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.product_collections
    ADD CONSTRAINT product_collections_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.product_collections DROP CONSTRAINT product_collections_pkey;
       public            neondb_owner    false    246            3           2606    41099 "   product_colors product_colors_pkey 
   CONSTRAINT     `   ALTER TABLE ONLY public.product_colors
    ADD CONSTRAINT product_colors_pkey PRIMARY KEY (id);
 L   ALTER TABLE ONLY public.product_colors DROP CONSTRAINT product_colors_pkey;
       public            neondb_owner    false    236            1           2606    41092 "   product_scents product_scents_pkey 
   CONSTRAINT     `   ALTER TABLE ONLY public.product_scents
    ADD CONSTRAINT product_scents_pkey PRIMARY KEY (id);
 L   ALTER TABLE ONLY public.product_scents DROP CONSTRAINT product_scents_pkey;
       public            neondb_owner    false    234            #           2606    41022    products products_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.products DROP CONSTRAINT products_pkey;
       public            neondb_owner    false    220            5           2606    41109    reviews reviews_pkey 
   CONSTRAINT     R   ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
 >   ALTER TABLE ONLY public.reviews DROP CONSTRAINT reviews_pkey;
       public            neondb_owner    false    238            '           2606    41041    scents scents_pkey 
   CONSTRAINT     P   ALTER TABLE ONLY public.scents
    ADD CONSTRAINT scents_pkey PRIMARY KEY (id);
 <   ALTER TABLE ONLY public.scents DROP CONSTRAINT scents_pkey;
       public            neondb_owner    false    224            P           2606    41210    session session_pkey 
   CONSTRAINT     S   ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
 >   ALTER TABLE ONLY public.session DROP CONSTRAINT session_pkey;
       public            neondb_owner    false    255            7           2606    41122    settings settings_key_key 
   CONSTRAINT     S   ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);
 C   ALTER TABLE ONLY public.settings DROP CONSTRAINT settings_key_key;
       public            neondb_owner    false    240            9           2606    41120    settings settings_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.settings DROP CONSTRAINT settings_pkey;
       public            neondb_owner    false    240            K           2606    41202    subscriber subscriber_email_key 
   CONSTRAINT     [   ALTER TABLE ONLY public.subscriber
    ADD CONSTRAINT subscriber_email_key UNIQUE (email);
 I   ALTER TABLE ONLY public.subscriber DROP CONSTRAINT subscriber_email_key;
       public            neondb_owner    false    254            M           2606    41200    subscriber subscriber_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.subscriber
    ADD CONSTRAINT subscriber_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.subscriber DROP CONSTRAINT subscriber_pkey;
       public            neondb_owner    false    254                       2606    40995    users users_email_key 
   CONSTRAINT     Q   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
 ?   ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_key;
       public            neondb_owner    false    216                       2606    40991    users users_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
       public            neondb_owner    false    216                       2606    40993    users users_username_key 
   CONSTRAINT     W   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);
 B   ALTER TABLE ONLY public.users DROP CONSTRAINT users_username_key;
       public            neondb_owner    false    216                       2606    41005 ,   verification_tokens verification_tokens_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.verification_tokens DROP CONSTRAINT verification_tokens_pkey;
       public            neondb_owner    false    218            !           2606    41007 1   verification_tokens verification_tokens_token_key 
   CONSTRAINT     m   ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_token_key UNIQUE (token);
 [   ALTER TABLE ONLY public.verification_tokens DROP CONSTRAINT verification_tokens_token_key;
       public            neondb_owner    false    218            N           1259    41211    IDX_session_expire    INDEX     J   CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);
 (   DROP INDEX public."IDX_session_expire";
       public            neondb_owner    false    255            �      x� � �      �   �  x�}VKr�F]S��t9N%U�QEI�-�U��]��0�`�GL�r mt�Mr�@*�B�F�O��C�~Ӱmy�N�ֳcKo�>{p�R�HVo�@6:b�m�{c�Җ�|�KgI�M#�P�]߱�j�u�%]��=܆}�Tw�^�f�:H�*V�Aվb-�{�v�Q�*k�[�o*5�h.XZ# 	�҇�YI^��+z�_�R�-�k9�RR��2�l�7-/�/8� �`h�b�k�t�\�Rf�9�-i�
�D�Ez�@��C?�N�T�],|v��fA�$�W
w�W�_�0�i�6m"moq}��%�.�&�\�0�t�D�	a�_=��[l�O�g�O^�V�̆�A�#�ѫHE*6&LN,�??$}3OTfNωǃJW�!��d)e<ܓ�%s�1�O�6@^HU�@|I�>O�	9ۨԚ�]]�F�ٚwb�0	 �:�wI�obAop�p�j&�g�Z�>%,�h�i[t�ނ'�7y/}P�;v�~�	T�e�I�tr�a@:1a�9�D�S�fz�*ig,!|�.cձk!n��6���&�I*�T@�5��LN]<鸾�.9�l"q�`,�lt�.%�F�!/�?s��	�8q�,�~hԛz^�?�呭�
�<�;Rd�e�l�^;>�I�x5�U�	�k6i�F�p��R,f/�U,$Bu�@�t�ig�D7�e�O�~�v9�i�,D�u��t;�)P �?i�L" +F&�)���~S�w�7�3j�Ňq��+�A(�)�Oz�z�<�ɓ�,�)8�Va�/2L:3\+�O=씬�Kx�tH#.1M�c#Y5�w*h`�S�T�OYbg�\dAv�aNw�G�B�]?�TH2%~�Ӷ	�9�Q,�eR��d�4�k�~�UcH�X�n�*�ME�ы�8��,T �"�FA�\�=�L�b �tȲ#%�o�p�S�t�`�5�+t)�S|q�DÄ0�O D,�ř�-<�7r� �T
�p$M�ܦS�*Af8� �E>�j�O[��ݛd�/��Ӫ      �      x� � �      �   �   x�%α
�0��[Ǥ�]A�A�"�2�[_̻$�}�$�~�҃Y(�~xx�!)�ݏj+D"�i�1�[�b���zk�}�Rb�!8(x�f�H�/Ǒ�"�t{�]�䢴'�Ӊ�J�-t�(Ct�!�4�         m   x�}ʻ	�0@�:��~�1?�?Ps+;��h�c�k�?�2�|�S?�[�E��$��_�a@qA�BA\0xT �F"�Yl孵A�#         v  x�N�@�O�O@�C�D�C�`b�p �PvI�$�0�R/��m�v�=P�!�ja�|i�ʂ�cr8� wӛD�?�F�[?�D鼓�0A�Aؖ�m�2Pd
g�bI�k�.VX�u�o�A�7F1qV�J,�.�ǟ��B
T�AW�΋�+p^�Tޖ5�{Y�D�~�f� �e�(�V,�c� �AkЄ�Aw5�5�A� �֬���E�AZ�ϭ�DqM;�B�kV�/KBhV� �j�@�L�j�L+SԀaM5�Sr�E6�)�i%�2�՜��}�VmI3l�5�Bʖϼ�i'I��S+         Q  x�KjA�u��*YdB/B6B�X�#r�\(K�$<�,�F�5|�
�S��b�Ȯ�䱀4��n�o�C;�~�<Vm�֏�x:�z�/]�w�%z��]�wM�3�E ;.��j{�.}k?�vpb�XCpC�̌�2�Ԝ*�5�&63�F�X�+�Ϣ^K�f־w�;�W��'�Xj �Q�"�Y�.�<�w�
%�'�Y�eB'�O�Cʙ3H6�̒�t�]ĒU^L�f)�Sy�F��7z�%�L�[b�'4z�#�Tz�Q�#$�ܶ�x*=W_FF�O�m</��ʤ{��G�*�m�%�8�Jϕ�Y0��R*WLirz��_'w*�Զ�T=�()C�ʫ�t�rq�#�媘�G)%�z�h�:�n�,�)}�\&rb;�냩�EHVRy�D>
�V�\���<�K:���}�m�y�'=O�WҝQK�<L�S�K�'�K�`1�zI�Ì_�0G|j�B�Rp���6�|�[, �*�      �   +  x�N�0�ϓ�Tu�ז�G�8�X� nR5�P��2�ɧ�7��:IknDv�r;ƹ�P�e�N��@M�p�=�Q�=�0h�I&X�u�Tjt�E�n�~[��4�c��g<�A�S<��	�k8�D�װ�:�4�p�u]��ch�\U�ǚj�P�3�*�_�X��՞�E#Q�Vr�j�}=x�SL�֬�(9�j�=�S0<�唋W�rJ��;��M[�j�l}lr�{��ը(�/u�      �   �  x�Kj#1 �u��RI�>�,2�bȦ�E��>�\h.6e�@�h�4��_��뼛�qP�|{�q�׆�a�պ��i_��i��X�N�q�q�yM�4��w˶�^�[��2�LL�I�B	�F�b=PQIZ�[�F�d�bC]1eP�	�ᾘx�l��'�b�B�:�.䥍�D�8C�A�wX�S�6*;�l�	T/ �ŖS��԰�~*ą�7�L�ia�i�e�g�+�e�)s�t|�i�q�3ƣ�U�(iz_s�ӊ�z!�p�4�B� �Ȕ�
OT1�^+�a�Z�r·V         =   x�EȻ !���Aj�:�2g6Z�EZ	2؞�PtT�u�_	�T_a�s0s      �   =  x�}UKr�6]˧��.�%)�e�]#Ů�H�l��  G��U��K�TlB�RY2�|�cݸQ�wLea�d.�&�H
G+uC)�C~n`FfK
�¤P	sm��n��#)]k� l2�0>�C!!'�:�/ZA�Ʈ�؃(�оd� �G-%�Q9x�ٺ�`�{n�P|jc!9��+�uZn;*]1p�*]�);� �%�b̘�`�jG�)�UN�h�V�#�H�`�8d�+�!�f�LM1w�fY�ϸfl�}�2LW�I�`N'r�ӿW�z�gɧ�п24�'��?9� �cj9�2�W�`&S�`�PA�+�g5@�j~�RW�6�9�e�ud���K2q�u�>sg	ׅ�
>aS�N�OǇ�ӟ�䗳�G�w'?8:8%Z9L�h"�:S�L�+V�9�sJŒ鰬W,`t����5�D�kWj�V�>�N�3�X%��"�\s�)�ΦX�,��e�g�b�)�$&�^���T�G�O�Q}䎍Ow�Ȓ�S�´I�F�/7�`(ac�!�`*�
�fR�ѫ0{��Tx0(�Z��#*!�}��M�Q�nU4ݫ3m�G&�ų��*�e�c�P�+dx_�Z+�3�[�STM��C��v���"F�T(3q��h�z�dw\�F˛e�{�)�\vCn��$�H�?�dQl*�!l�k�~)�9I�N��W�T!�R�O�T6�zS�Ҵ/�}'u�Yp	�)֔�o�2�r_�HB�&o��_�⛺��t'�[5�B�|�q�"�I�E�w0�n*1)�b� �oA�S|��g�_Bec��[O� t�D`���A�}w{��9J�Nw^}k�-x�I�IN}+R.7�!nЯ�L�D��)Qnjׄ�{�i�,Lucb���^�%�7��=� 6�?�ד��VG�_oEa            x� � �      �   �  x�%�˕$1�%c�I�|��ҙ#D�PhV�o�x�Z�skH�Np�	z�	r��;D�1[�1�dL2�N@�d�	^��-v8��K�>�I]�C�%}� �46t�t6�Ȑ,HH.dV�Xؒ=Ȗ�8.L[� �LX�h�A�ewG�NZ�Mze�F�r�>;�z�c�ڣ�sө=̦�%j�@d�_��4^gO�,H�|Cg?��<�lst�Q��d�ùS�#�OHp{�5v�9�~˧Ҹ�xRn�`(�-�6�B�Ӗ� �A:�1q�qSB+3%�0դ�$�.3tz7@k�u�w�rMgW�q�b�%ĞcP�
�}vX/+�*F��4^�3�o�Z)�]:v�.r]`�kvI�ۥ׸�'�D�&{J`*�TB�ɂ�9�Y� yIkZIn[*�gJ�'S�H��Z��n�      �     x�%�A�$!�S�w�c"��+1 �s�_�&�b�}��BL.'�9q�؍�LO�<X��L�XD_U�^la�ߺC�S��w!.6�V�'d�̇m&�di�'�rr>,b`񋉅�%�ȑXȱ�m4bH4V�4�i�K(�sp'D�AvD�q�}�>~9�b!��
�L�A�X�y�2�8D3�o�߄�/�0c�/�@�VuZ�V�<yU!�4��@4}!�~M�G�/�dΰ�p�i�x�i��1�.�1�2Ogg2�?�W2�N�m:�ƞ�'�|�@Ma�
6<�30�a�)3�L�|O!�="-�4&e�I�eR�A�mPe�m�Z�j�J,Ak�!h5bI4h�4h�4�5-�^�h��e�ݭ8wO+ݪ�'���ι�t�~M'��(']:�.�I��d/�^:ԓ�t�'{�PO�t(']:l�t�\�2Y:W&K�6S�f�jX�/�d�c�8�t�V�*Y�e3�Ӽ�j:�Vө5�G�X.��U�rVM0GCL�tr� }��l�v+�}t�>�'�N:�t�r�}v�q�N�a_��y�=�Yw�|�{L޵7�ݵWLݵw�f�"n�7�K�]!�T�Bar�\5E�ѿ��xwQQ�(ܭV�*�vE�@�J4�i�[�m�_�      �   3  x�XKr�F]�H�# �d%�?m+Ni3 ��53m�r�A+�x�$�P��I%�0ӯ_�n �uG�6�E	��A�s�UmӀd�dG�?�f%�YE�5H`��0�%�oݕ�xDH�)
v"�a�R5� �鶮A:l�;hx�o�sY�\U ��*� K�i�+p�:Y�M�Q�õf�T�%�V\g:A2*�Y�^e�6�׌K�,�f�[�-�hx�$�t�i�<v��p2:C��9�(U�lO�X[�]�-5'�s��i֛o2�1�^&�6�Aɒ�c�!�F`��]Qw��S= �
�R`$�zoⅻ�pכ27�,�xy�;v�(9Ռ�ي�<$�a%)�Uk�nMK�a�E�Gjr�Rʝ`�JN	2��hL�: �]� �>\�kH�q�Yj֘9О%WM+-�Nڶr�۔�Z#�U܈v�[�l	�Yo.�@;�WC;0�N�r�%4�o�E�85�J�;m6�%�|�%.�r.g�Nr�Mሦ蔕�{9��i/�ڋf�t�zN'I0G�I�/�}�V�tKX�"�s�K�QeP*�e_�gDa�R�WB�I[=�7�ԣ,%�%d\夽kp�)D�AC�_٪j�:si�ٰ�^�8���ʰ�5�i�2�Ap�v�hl�톈�*@I!�u9t�(��V�4c+�m��d�~�1�m�Hà�X�K�\J�E�p�ɏT{�g�j�11�̐o%�8xV�V�{}�o�^�$X8�OI�(Lb:���d!�Z9�f�ē0�L�޳��D�y�n=Y�̝�q9��a2�Ⱥ/ȳ���t�"�d�q�=qۙ�'r�Q�G�\�w�^�2\6�Yo�B#&z�~�9HP���o�O�.�M	FT;� +K�S�
�U�{{�E�i^u�t6yN�m�e +�^���V0�P�zj7	v(��D�Vl8�0�]�lp-.@�#Q`�4;�Rڈ�&m�ޮ8�q�ª�[|�80�,�n�j�\�K�_�ITfB�.ʕm l�3�@Ͷ�QwU�}=�n�+�m�4�E4�'3U�LAv��1�w�&5�z��$�I<�ۀ�;�Ʈ7�o�ɭ/wׁ�ڢ�&Z�5�VmY�j�>t�/�f{��A��>�k씺�0EX�E�vr�x� {�?>�t׳�Mٺ�DB?�OA`�J�jR�V�}�T�4�Nq_�3_Y�w0�0�
Sʛ�r�A�K�%�έ*Q�ۈ�P6( Ӵz�W�j�~�֓ߎ�Ҫ�}*~�μ�OƮ�,�X�ͧ�I�;b}�5�>�5&S?Hp�z�a=[�?4�lzڽ}2�0fA섑G���.�      �      x� � �      �   �  x�u�Kr1�:�8�k.�@�Sv�b�a�HS�&.�[d�Kk�bo(F�[]�S�ZM�7�G�x�S�{�8�7h�C�
҉�I�q�V�u�L�۟�K�=�,7�D.�FԴ�HZ�Ω�yP�,"ic�^�͍�&ᯅ��F�)�Ye��31�H(�g�0�5�Fykr�E.E�lI�nY�`̑sY�½E�oM�^A"AS�sqi2#'�2f��$@�7��M� ׻�B�j�0�=0Eo� �JS9�t�*�k�lm�|!�_NNAo)q�
P:�&@�-6�4؆58�6�>E�Tĵ��o8�\#�ye�o
�֔�T}�{�MM0�'q�Q�J�yo�ū��{	�+�3�֫P�V�,�T�LDR�#�з��ݜ�;$�Y\��e1Z�l䎛�%Mr=_D_A�#R�(�	ۅ�r�c;�a8�`_��V�O�.@)E�j�<
�=�G�o�YzD�E| �"5�z�-�ףr͓<��N7�En�3�,
�C	�*W�
Ԧ�U�qu��)�ʦ<-���j�¾��V�V�g�A�sě�VE�v֊�s��8      
   �  x�]o�0�˯�.�666�K mHJ�֤�$4P�i�n�^LZW�}t8�q?�Ǔ�f�РҏOUgg��($Wo�6I�>�q��@�\�9r� "
��P�q�U�|-�e�"�2?z�rꖾ8q#�E�&yY�9^.�߯~�d�Bi�9?g�,3�A�|�
7�U�=O�l�LL!�BU݀M�k�O1&-O��1�Cq��?�U&5N�Y�й�U�.�e!�E�!R�c3v�v� G�5�&�?�!!�ߑ�'d(�8�w.��>e��0�?�5@�Sd�7*�!2l�#�t׏�Ua��vM�[�vK�؜�a�
�ׂ�?��
�bn�A�2�Uv�sk�`a�׋�=� �:˚�P�;�p?�!�۰SN�C�W۹�[�)K�
�k�b H%5_4�� H�v�kO b�ބ�@�d��$�&�#@jd �:S&�β�EFX�:=�`/�=�[�/&w�f�%�~8B*M/�&�7�͠z�_m�M�3�*]�N�u`�:�l�%�o�$I��26�      �   U  x�W�n�6>KO1е�!ɶb�Tt�]�b�:�űE�"U�Jb/r�i}� }�b/�W��Q�{�d�o�Tz�G��G�Du�x�L	/�i�=��N؏�V�u���2�
�0�ƹ�>T�`Y�~A!�A�/�ʲ�6�?)	�9a'�&?i�J]Y&G��@,�P�٘�Ӷ�2]���jw�鴓$l�zq�k�.̴�f.�t�TޏN�C�!�a�`b�"�ܶ(��j�N� �%.*�c`�x�6�8�_il�7Rs]�`BĒ�ε�QLs�Za!�ZrϴԆ�ra1�9i�3X(x�y�v�]N�a�5�W�ᗿM�P++$\�A�f�_V�$�6U�zl4�IR�s��]�.�-T�q�'{�(y�g�ե�Q�l�f�>:^� .�u�G �"Gx��:�F�11�*@�b�9�D�B:�8�yv�P]�1$�ՆV\GI�f3ғ�q�/(Yp�
� �kl�)��T�U�ݧ�I��"Q�*YrS��L�qQ�5�{e9fs�T�4X9mR�Z�)3VL�(d�ӾOq�n�R�w%�	�-L�c`���c�*Ga[�]�܈�EP�v~BU�i�Z�<�L}�IiK�B%��@�.�jp�h�k(�j^�E\�E��9�
ꏚ�I�Z��X�+!K�6d�6T��Y�*�p�j�3MK�d�:c�tI.�͘+�X�&�bRl�-�]�J4�Н>�|�3�ca��B�l�
�u�冐ˊ�'E)�ge+�󷏢�[�gۥёҦ`�7�z]2w�8M�f�ď�~�ǝV�I�d�ɏC�d:�h�|�*�"q�P�D�YS�#@b�,%�8n�n�0�Y�Mϒ�{@�V�q�0�QҀ�D�A{iܥ[�&?�5�sɌb�{Q�Gi�e�1J¸�R�&?�&q�EN_9�2�Kk�Ջ�,�a�ݗU3��'f�`�ץ�j9
�o-��?S      	   X   x�34�LI�L�I�+.�O�OI4rH�M�K�w�q�u�t	5�L�4202�50�52V04�24�20�3�0655�LI� Đ�      �   �  x�ՔK�7�5�L�D=z� ^�*Y��~��'Ʌr�0��08FVA	�*R,R�b]^�i�/�&�
T{r�A�L I�h�|�BNR�
�1i�g�Ug�&�\
x)ڊ$>,�f�$&(:)�8[�,5a��i�&i�\�^�z�p�g�͑�*�/�V�vK��c�;�m<�1��>�>�: !�ŷ��,�M�vZ&�X,{�.#�'�Hn.<�9T#�"8Ü�cmAeLk�0�
�C,s/ҭg*}$�Erŉ#�
�
%��F�s*�1�ˇ�x�S�ޝw�,?^��ov�b�v�8�i�].�j-[.�~�0�s[�
�=<ޏ|
�C[^�7J�^�NY=G��4%Q'�.�r�ꤎ�V�9X:5U�Y%1�$ 5yĄ\&�i�(�\��VW�#;HG�(�^('(�V�׀�o�~�/�R~�3]��nu�||�O�j�{�=_x��u�A�$@�8�b��v4�T�_�g@ 2�^:��ae��sC��e�5��\)5*%c%�EM��jm9D�M��?@Tw�ѷ�/C�z}xx�O�      �   �   x�]ϻ�1�X[���[�H�_�98�y���ZZ�%0�J�wZ+VΈ�h70�B�5�iZt�'�p!]�'N�8�`:�c�$�;}v�̻�&*L�6P�(E�a{f�S�e�DO�wC;d�̙,{�U�oI6�t��<v�.�k�T�_�|�]�g�}9Ƥ�u��Tm     