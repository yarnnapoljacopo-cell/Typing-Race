--
-- PostgreSQL database dump
--

\restrict 2yWVlAxSBLd9cNmDVkx56o6Nhiu6fFgZpuVJW6t03therA30oI9qqgPJJpfl8It

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id integer NOT NULL,
    requester_id character varying(100) NOT NULL,
    addressee_id character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: friendships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.friendships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: friendships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.friendships_id_seq OWNED BY public.friendships.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    code character varying(20) NOT NULL,
    creator_name character varying(100) NOT NULL,
    duration_minutes integer NOT NULL,
    countdown_delay_minutes integer DEFAULT 0 NOT NULL,
    mode character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    word_goal integer,
    death_mode_wpm integer,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    start_time bigint,
    end_time bigint,
    countdown_ends_at bigint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    boss_word_goal integer,
    password_hash character varying(100),
    gladiator_death_gap integer
);


--
-- Name: sprint_writing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sprint_writing (
    id integer NOT NULL,
    room_code character varying(20) NOT NULL,
    participant_name character varying(100) NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    word_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    clerk_user_id character varying(100),
    saved_to_files boolean DEFAULT false NOT NULL,
    room_mode character varying(20) DEFAULT 'regular'::character varying NOT NULL,
    word_goal integer,
    xp_awarded boolean DEFAULT false NOT NULL
);


--
-- Name: sprint_writing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sprint_writing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sprint_writing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sprint_writing_id_seq OWNED BY public.sprint_writing.id;


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    clerk_user_id character varying(100) NOT NULL,
    writer_name character varying(50) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    last_sprint_at timestamp without time zone,
    decay_checked_at timestamp without time zone,
    active_nameplate character varying(20) DEFAULT 'default'::character varying NOT NULL,
    active_skin character varying(20) DEFAULT 'default'::character varying NOT NULL
);


--
-- Name: friendships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships ALTER COLUMN id SET DEFAULT nextval('public.friendships_id_seq'::regclass);


--
-- Name: sprint_writing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprint_writing ALTER COLUMN id SET DEFAULT nextval('public.sprint_writing_id_seq'::regclass);


--
-- Data for Name: friendships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.friendships (id, requester_id, addressee_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (code, creator_name, duration_minutes, countdown_delay_minutes, mode, word_goal, death_mode_wpm, status, start_time, end_time, countdown_ends_at, created_at, updated_at, boss_word_goal, password_hash, gladiator_death_gap) FROM stdin;
SPRINT-9113	Entrail	30	0	boss	\N	\N	finished	1776856227572	1776858027572	\N	2026-04-22 11:10:11.521127	2026-04-22 11:10:33.327	25000	\N	\N
SPRINT-1234	Entrail	30	0	boss	\N	\N	finished	1776857172273	1776858972273	\N	2026-04-22 11:26:05.596385	2026-04-22 11:26:33.485	5000	\N	\N
SPRINT-2879	jj	30	0	open	\N	\N	waiting	\N	\N	\N	2026-04-22 11:39:15.965322	2026-04-22 11:39:15.956	\N	\N	\N
SPRINT-4280	jj	30	0	regular	\N	\N	waiting	\N	\N	\N	2026-04-22 11:42:22.576822	2026-04-22 11:42:22.566	\N	$2b$10$LSgmSz/71pJvvjZA3No6Y.cs/SjusS7xj7i/pfVq4QY/notmqXp1K	\N
SPRINT-3531	jj	30	0	regular	\N	\N	waiting	\N	\N	\N	2026-04-22 11:43:19.786442	2026-04-22 11:43:19.775	\N	$2b$10$HL2RIYaOmKtWR3/0ksmxS.9ZVH27eyTT8GZ73XTKhRAyRhAQvtHD6	\N
SPRINT-3856	jj	30	0	regular	\N	\N	finished	1776858591253	1776860391253	\N	2026-04-22 11:45:26.65162	2026-04-22 11:49:51.923	\N	$2b$10$QIRAjf.plyRQvZPYMmgYUeCtNFjK6LKZaGMyrW82iNl7oBUOcfZlK	\N
SPRINT-9657	TestWriter	15	0	gladiator	\N	\N	waiting	\N	\N	\N	2026-04-22 13:10:15.565503	2026-04-22 13:10:15.553	\N	\N	\N
SPRINT-8489	TestGladiator	30	0	gladiator	\N	\N	waiting	\N	\N	\N	2026-04-22 13:19:46.724628	2026-04-22 13:19:46.713	\N	\N	\N
SPRINT-4325	Gladiator	30	0	gladiator	\N	\N	waiting	\N	\N	\N	2026-04-22 13:22:15.724074	2026-04-22 13:22:15.71	\N	\N	200
SPRINT-6039	Warrior	30	0	gladiator	\N	\N	waiting	\N	\N	\N	2026-04-22 13:30:26.510334	2026-04-22 13:30:26.497	\N	\N	200
SPRINT-4100	Warrior	30	0	gladiator	\N	\N	waiting	\N	\N	\N	2026-04-22 13:30:31.235866	2026-04-22 13:30:31.234	\N	\N	200
SPRINT-7387	TestGuestews5l	30	0	regular	\N	\N	finished	1776869678842	1776871478842	\N	2026-04-22 14:54:32.872251	2026-04-22 15:24:39.269	\N	\N	\N
SPRINT-7745	Testerrxp8	30	0	regular	\N	\N	finished	1776869950145	1776871750145	\N	2026-04-22 14:59:03.899635	2026-04-22 15:29:10.5	\N	\N	\N
\.


--
-- Data for Name: sprint_writing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sprint_writing (id, room_code, participant_name, text, word_count, updated_at, clerk_user_id, saved_to_files, room_mode, word_goal, xp_awarded) FROM stdin;
1	SPRINT-TEST	Alice	Once upon a time in a land far away	9	2026-04-21 11:36:14.276233	\N	f	regular	\N	f
2	SPRINT-9999	Bob	The quick brown fox jumps over the lazy dog and runs away fast	14	2026-04-21 11:41:12.143365	\N	f	regular	\N	f
20	SPRINT-3856	jj		0	2026-04-22 11:49:52.411289	\N	f	regular	\N	f
3	SPRINT-1941	En	This goes on w	35	2026-04-21 13:08:29.091	\N	f	regular	\N	f
21	SPRINT-4977	Hh	<div>Bb b b h h HHH k Bb b b h h HHH k&nbsp;</div><div>I j Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div><br></div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div><br></div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div>Bb b b h h HHH k&nbsp;</div><div>I j&nbsp;</div><div>h j</div><div>ubk ubm</div><div>i l</div><div>on</div><div>j o</div><div>o</div><div><br></div>	274	2026-04-22 12:42:32.874	\N	f	kart	\N	f
26	SPRINT-4816	jj	TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff TJosj&nbsp; &nbsp;f f f f f f f f f f f f f f&nbsp; &nbsp;d d d d d d d d d d dd fff&nbsp;	162	2026-04-22 13:36:31.138687	\N	f	gladiator	\N	f
35	SPRINT-7387	TestGuestews5l	The quick brown fox jumps over the lazy dog. Writing sprints are a great way to build a daily writing habit and improve productivity.	24	2026-04-22 14:54:51.047944	\N	f	regular	\N	f
36	SPRINT-7745	Testerrxp8	Once upon a time there was a brave writer who typed every single day without fail.	16	2026-04-22 14:59:27.032167	\N	f	regular	\N	f
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_profiles (clerk_user_id, writer_name, updated_at, xp, last_sprint_at, decay_checked_at, active_nameplate, active_skin) FROM stdin;
user_3CiY7lLewp4GGsc29FoWAdmmlgr	Sprint	2026-04-22 14:55:07.64318	0	\N	\N	default	default
user_3CgVMyH8PeKVGQo8m9bFklR91cp	Entrail	2026-04-22 15:33:37.767	200000	2026-04-22 14:02:16.992	2026-04-22 14:02:16.992	gold	default
user_3CjYoTjyaSSIxV27QqIKDwvUMnL	Entrail_JI	2026-04-22 23:35:14.345854	0	\N	\N	default	default
\.


--
-- Name: friendships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.friendships_id_seq', 1, false);


--
-- Name: sprint_writing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sprint_writing_id_seq', 36, true);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (code);


--
-- Name: sprint_writing sprint_writing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sprint_writing
    ADD CONSTRAINT sprint_writing_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (clerk_user_id);


--
-- Name: friendships_pair_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX friendships_pair_idx ON public.friendships USING btree (requester_id, addressee_id);


--
-- Name: sprint_writing_room_participant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sprint_writing_room_participant_idx ON public.sprint_writing USING btree (room_code, participant_name);


--
-- Name: friendships friendships_addressee_id_user_profiles_clerk_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_user_profiles_clerk_user_id_fk FOREIGN KEY (addressee_id) REFERENCES public.user_profiles(clerk_user_id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_user_profiles_clerk_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_user_profiles_clerk_user_id_fk FOREIGN KEY (requester_id) REFERENCES public.user_profiles(clerk_user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 2yWVlAxSBLd9cNmDVkx56o6Nhiu6fFgZpuVJW6t03therA30oI9qqgPJJpfl8It

