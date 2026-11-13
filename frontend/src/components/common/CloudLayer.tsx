import { AnimatePresence, motion } from "motion/react";
import { useCloudSegments } from "../../states/cloudLayer";

interface Puff {
  left: number; // persen
  top: number; // px, offset
  size: number; // px
}

const ROW: Puff[] = [
  { left: -20, top: -10, size: 260 },
  { left: 10, top: 40, size: 300 },
  { left: 45, top: -20, size: 250 },
  { left: 70, top: 30, size: 290 },
  { left: 95, top: -10, size: 220 },
];

const ROW_STEP = 120;
const OVERLAP_TOP = 60;
const OVERLAP_BOTTOM = 0; 
const CLOUD_COLORS = ["#FDFDF9", "#F6F2EB", "#EFE9DF", "#FBF8F2"];

const CloudBand = ({ height }: { height: number }) => {
  // Kurangi tinggi kalkulasi (dikurangi 240px) agar row terakhir tidak 
  // mencetak lingkaran sampai bawah banget dan menutupi matahari unit sebelumnya.
  const rowCount = Math.max(1, Math.ceil((height - 240) / ROW_STEP));

  return (
    <>
      {Array.from({ length: rowCount }, (_, row) =>
        ROW.map((puff, i) => {
          const shift = row % 2 === 0 ? 0 : 15;
          const bgColor = CLOUD_COLORS[(row + i) % CLOUD_COLORS.length];
          return (
            <motion.div
              key={`${row}-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${puff.left + shift}%`,
                top: row * ROW_STEP + puff.top,
                width: puff.size,
                height: puff.size,
                backgroundColor: bgColor,
              }}
              exit={{
                opacity: 0,
                scale: 0.9,
                y: -30,
                transition: {
                  duration: 1.2,
                  delay: ((row * ROW.length + i) % 7) * 0.05,
                  ease: "easeInOut",
                },
              }}
            />
          );
        }),
      )}
    </>
  );
};

const CloudLayer = () => {
  const segments = useCloudSegments();
  const covered = segments.filter((segment) => segment.covered);

  if (covered.length === 0) return null;

  return (
    // overflow-x-clip memotong elemen yang melebar ke samping (mencegah scroll horizontal), 
    // tapi membiarkan awan atas/bawah tidak terpotong kaku.
    <div className="absolute inset-x-0 top-0 z-20 pointer-events-none overflow-x-clip">
      <AnimatePresence>
        {covered.map((segment) => (
          <motion.div
            key={segment.id}
            exit={{ opacity: 1 }}
            // drop-shadow dipertajam dan diperbesar spread-nya agar awan berasa melayang jauh di atas
            className="absolute inset-x-0 drop-shadow-[0_28px_36px_rgba(40,60,99,0.22)]"
            style={{
              top: segment.top - OVERLAP_TOP,
              height: segment.height + OVERLAP_TOP + OVERLAP_BOTTOM,
            }}
          >
            <CloudBand height={segment.height + OVERLAP_TOP + OVERLAP_BOTTOM} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CloudLayer;