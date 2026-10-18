# Room veritabanları sınıf adından yansıma (reflection) ile oluşturulur:
# "<Veritabanı>_Impl". R8 bu adları değiştirirse uygulama açılışta çöker.
# WorkManager (AdMob SDK'sının bağımlılığı) bu yüzden şu hatayı veriyordu:
#   Failed to create an instance of androidx.work.impl.WorkDatabase
-keepnames class * extends androidx.room.RoomDatabase
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
