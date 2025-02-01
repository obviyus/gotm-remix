create table igdb_platforms (
  igdb_id bigint unsigned not null primary key,
  name varchar(255) null,
  logo varchar(255) null,
  created_at timestamp null,
  updated_at timestamp null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table jury_members (
  id bigint unsigned auto_increment primary key,
  discord_id varchar(20) not null,
  name varchar(255) not null,
  active tinyint(1) default 1 not null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint jury_members_discord_id_unique unique (discord_id)
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table migrations (
  id int unsigned auto_increment primary key,
  migration varchar(255) not null,
  batch int not null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table theme_categories (
  id bigint unsigned auto_increment primary key,
  name varchar(255) not null,
  created_at timestamp null,
  updated_at timestamp null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table themes (
  id bigint unsigned auto_increment primary key,
  theme_category_id bigint unsigned not null,
  name varchar(255) not null,
  description text null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint themes_theme_category_id_foreign foreign key (theme_category_id) references theme_categories (id) on update cascade on delete cascade
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table months (
  id bigint unsigned auto_increment primary key,
  theme_id bigint unsigned null,
  year smallint not null,
  month tinyint not null,
  status enum (
    'ready',
    'nominating',
    'jury',
    'voting',
    'playing',
    'over'
  ) default 'ready' not null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint months_year_month_unique unique (year, month),
  constraint months_theme_id_foreign foreign key (theme_id) references themes (id) on update cascade on delete
  set
    null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table nominations (
  id bigint unsigned auto_increment primary key,
  month_id bigint unsigned null,
  game_id varchar(20) not null,
  discord_id varchar(20) not null,
  short tinyint(1) null,
  game_name varchar(255) not null,
  game_year varchar(255) null,
  game_cover varchar(255) null,
  game_url varchar(255) null,
  game_platform_ids varchar(255) null,
  jury_selected tinyint(1) default 0 not null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint nominations_month_id_game_id_unique unique (month_id, game_id),
  constraint nominations_month_id_foreign foreign key (month_id) references months (id) on update cascade on delete
  set
    null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table pitches (
  id bigint unsigned auto_increment primary key,
  nomination_id bigint unsigned null,
  discord_id varchar(20) not null,
  pitch text null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint pitches_nomination_id_discord_id_unique unique (nomination_id, discord_id),
  constraint pitches_nomination_id_foreign foreign key (nomination_id) references nominations (id) on update cascade on delete cascade
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table votes (
  id bigint unsigned auto_increment primary key,
  month_id bigint unsigned null,
  discord_id varchar(20) not null,
  short tinyint(1) null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint votes_month_id_foreign foreign key (month_id) references months (id) on update cascade on delete
  set
    null
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table rankings (
  id bigint unsigned auto_increment primary key,
  vote_id bigint unsigned not null,
  nomination_id bigint unsigned not null,
  `rank` int not null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint rankings_vote_id_rank_unique unique (vote_id, `rank`),
  constraint rankings_nomination_id_foreign foreign key (nomination_id) references nominations (id) on update cascade on delete cascade,
  constraint rankings_vote_id_foreign foreign key (vote_id) references votes (id) on update cascade on delete cascade
) engine = InnoDB collate = utf8mb4_unicode_ci;

create table winners (
  game_id varchar(20) not null primary key,
  month_id bigint unsigned null,
  nomination_id bigint unsigned null,
  short tinyint(1) null,
  game_name varchar(255) not null,
  game_year varchar(255) null,
  game_cover varchar(255) null,
  game_url varchar(255) null,
  game_platform_ids varchar(255) null,
  created_at timestamp null,
  updated_at timestamp null,
  constraint winners_month_id_foreign foreign key (month_id) references months (id) on update cascade on delete
  set
    null,
    constraint winners_nomination_id_foreign foreign key (nomination_id) references nominations (id) on update cascade on delete
  set
    null
) engine = InnoDB collate = utf8mb4_unicode_ci;