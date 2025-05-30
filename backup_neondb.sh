# --- Konfiguracija baze podataka ---
# PROMIJENI OVO! Ovo je tvoj cijeli connection string iz Neon dashboarda.
# Pazi da lozinka bude stvarna lozinka, a ne zvjezdice!
NEON_CONNECTION_STRING="postgresql://neondb_owner:npg_myo3xFYRIs1O@ep-late-voice-a6pxyqcp.us-west-2.aws.neon.tech/neondb?sslmode=require"

# Pretpostavimo da Reptil.com ima neko privremeno ili trajno mjesto za spremanje datoteka
# Možda /tmp, /app/data, ili slično. Provjeri dokumentaciju Reptil.com.
BACKUP_DIR="public/DATABAZA" # PAŽNJA: Ovo mora biti putanja koja je dostupna i trajna unutar Reptil.com okruženja!

# --- Generiranje imena datoteke za backup ---
DB_NAME=$(echo "$NEON_CONNECTION_STRING" | sed -n 's/.*\/[^?]*\/\([^?]*\)\(\?.*\)\?/\1/p') # Pokušava izvući ime baze iz connection stringa
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DB_NAME}_${TIMESTAMP}.sql"
FULL_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# --- Provjera postoji li backup direktorij, ako ne, kreiraj ga ---
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "Kreiran backup direktorij: $BACKUP_DIR"
fi

echo "Pravim sigurnosnu kopiju baze podataka '$DB_NAME'..."

# --- Izvršavanje pg_dump naredbe ---
pg_dump "$NEON_CONNECTION_STRING" -Fc --no-owner --no-privileges --clean --verbose -f "$FULL_PATH"

# --- Provjera je li backup uspješno napravljen ---
if [ $? -eq 0 ]; then
    echo "Sigurnosna kopija baze podataka '$DB_NAME' uspješno kreirana u: $FULL_PATH"
    echo "Datoteka je spremljena na: $FULL_PATH"
else
    echo "Greška prilikom kreiranja sigurnosne kopije baze podataka '$DB_NAME'."
    echo "Provjeri svoj NEON_CONNECTION_STRING i jesi li instalirao postgresql-client."
fi

# Ovisno o Reptil.com, možda ćeš htjeti preuzeti ovu datoteku
# ili je kopirati na neko trajno skladište (npr. S3, ako Reptil.com to podržava).
