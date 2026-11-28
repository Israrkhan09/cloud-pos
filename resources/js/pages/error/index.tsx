import { Head, Link } from "@inertiajs/react";
import Icon from "@/components/ui/icon";

const ErrorPage = ({ status }: { status: number }) => {
    return (
        <>
            <Head title={`Error ${status || ''} - Vegetable POS`} />
            <div className="bg-[#f4f7f4] min-h-screen flex flex-col items-center justify-center p-4 relative font-sans">
                {/* Top Center: Back to Dashboard Button */}
                <div className="w-full flex justify-center py-4 absolute top-2 left-0 right-0 z-10">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532d] hover:bg-[#0f3d21] text-white font-semibold text-xs md:text-sm shadow-md transition-all cursor-pointer"
                    >
                        <Icon name="ArrowLeft" className="w-4 h-4" weight="bold" />
                        <span>Back to Dashboard</span>
                    </Link>
                </div>

                {status === 404 && (
                    <div className="text-center flex flex-col gap-3 items-center justify-center max-w-lg">
                        <img src="/icons/svgs/19.svg" className="w-64 h-64 md:w-80 md:h-80" alt="404" />
                        <h1 className="text-3xl font-bold text-gray-900">Page Not Found</h1>
                        <p className="text-gray-600 text-sm">
                            The page you are looking for does not exist or has been moved.
                        </p>
                        <div className="pt-2">
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532d] hover:bg-[#0f3d21] text-white font-semibold text-xs shadow-xs"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                )}

                {status !== 404 && (
                    <div className="text-center flex flex-col gap-3 items-center justify-center max-w-lg">
                        <img src="/icons/svgs/20.svg" className="w-64 h-64 md:w-80 md:h-80" alt="500" />
                        <h1 className="text-3xl font-bold text-gray-900">Server Error</h1>
                        <p className="text-gray-600 text-sm">
                            An unexpected server error occurred. Please try again later or return to the Dashboard.
                        </p>
                        <div className="pt-2">
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532d] hover:bg-[#0f3d21] text-white font-semibold text-xs shadow-xs"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ErrorPage;
