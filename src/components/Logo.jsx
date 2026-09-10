import { Image as ImgCmp } from "@/components/ui/image";

const LOGO_URL = "https://media.base44.com/images/public/6aa29ae2c83b44fa65bdbaa2/4463d8ffc_generated_image.png";

export default function Logo({ className = "" }) {
  return (
    <ImgCmp
      src={LOGO_URL}
      alt="Revisô"
      fittingType="fit"
      className={`rounded-lg bg-white ${className}`}
    />
  );
}