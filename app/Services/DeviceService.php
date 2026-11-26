<?php

namespace App\Services;

use App\Models\Option;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class DeviceService
{
    /**
     * Cache key for runtime retrieval
     */
    protected static ?string $cachedDeviceId = null;

    /**
     * Clear runtime cached device ID (useful for tests or device switching).
     */
    public static function clearCache(): void
    {
        static::$cachedDeviceId = null;
    }

    /**
     * Get or create the unique, persistent Device ID for this installation.
     */
    public static function id(): string
    {
        return (new static())->getDeviceId();
    }

    /**
     * Get or create the persistent Device ID.
     */
    public function getDeviceId(): string
    {
        if (static::$cachedDeviceId !== null) {
            return static::$cachedDeviceId;
        }

        // 1. Check environment variable (injected by Electron or .env)
        $envDeviceId = env('DEVICE_ID');
        if (!empty($envDeviceId) && is_string($envDeviceId)) {
            static::$cachedDeviceId = trim($envDeviceId);
            $this->persistToStorage(static::$cachedDeviceId);
            $this->persistToDatabase(static::$cachedDeviceId);
            return static::$cachedDeviceId;
        }

        // 2. Check local persistent storage file (storage/app/device_id.json)
        $storageId = $this->readFromStorage();
        if (!empty($storageId)) {
            static::$cachedDeviceId = $storageId;
            $this->persistToDatabase($storageId);
            return static::$cachedDeviceId;
        }

        // 3. Check database options table
        $dbId = $this->readFromDatabase();
        if (!empty($dbId)) {
            static::$cachedDeviceId = $dbId;
            $this->persistToStorage($dbId);
            return static::$cachedDeviceId;
        }

        // 4. Generate new unique device ID if none exists
        $newDeviceId = $this->generateUniqueDeviceId();
        static::$cachedDeviceId = $newDeviceId;

        $this->persistToStorage($newDeviceId);
        $this->persistToDatabase($newDeviceId);

        return $newDeviceId;
    }

    /**
     * Get full device identity information for sync handshake.
     */
    public function getDeviceInfo(): array
    {
        $deviceId = $this->getDeviceId();
        $filePath = $this->getStorageFilePath();
        $createdAt = null;

        if (File::exists($filePath)) {
            $data = json_decode(File::get($filePath), true);
            $createdAt = $data['created_at'] ?? null;
        }

        return [
            'device_id'   => $deviceId,
            'hostname'    => gethostname() ?: 'unknown',
            'os'          => PHP_OS_FAMILY,
            'php_version' => PHP_VERSION,
            'created_at'  => $createdAt ?: date('c'),
        ];
    }

    /**
     * Generate a new device ID with standard POS prefix.
     */
    protected function generateUniqueDeviceId(): string
    {
        return 'POS-' . strtoupper(Str::uuid()->toString());
    }

    /**
     * Path to local persistent device ID storage file.
     */
    protected function getStorageFilePath(): string
    {
        $dir = storage_path('app');
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true, true);
        }
        return $dir . DIRECTORY_SEPARATOR . 'device_id.json';
    }

    /**
     * Read device ID from local storage file.
     */
    protected function readFromStorage(): ?string
    {
        $filePath = $this->getStorageFilePath();
        if (File::exists($filePath)) {
            $content = File::get($filePath);
            $data = json_decode($content, true);
            if (!empty($data['device_id']) && is_string($data['device_id'])) {
                return trim($data['device_id']);
            }
        }
        return null;
    }

    /**
     * Persist device ID to local storage file.
     */
    protected function persistToStorage(string $deviceId): void
    {
        try {
            $filePath = $this->getStorageFilePath();
            $data = [
                'device_id'  => $deviceId,
                'hostname'   => gethostname() ?: 'unknown',
                'created_at' => date('c'),
            ];
            File::put($filePath, json_encode($data, JSON_PRETTY_PRINT));
        } catch (\Throwable $e) {
            // Fail safely if storage permissions are restricted
        }
    }

    /**
     * Read device ID from options database table.
     */
    protected function readFromDatabase(): ?string
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('options')) {
                $option = Option::where('meta_key', 'device_id')->first();
                if ($option && !empty($option->meta_value)) {
                    return trim($option->meta_value);
                }
            }
        } catch (\Throwable $e) {
            // Database may not be ready or migrated yet
        }
        return null;
    }

    /**
     * Persist device ID to database options table.
     */
    protected function persistToDatabase(string $deviceId): void
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('options')) {
                Option::updateOrCreate(
                    [
                        'meta_key' => 'device_id',
                    ],
                    [
                        'meta_value'    => $deviceId,
                        'meta_category' => 'sync',
                    ]
                );
            }
        } catch (\Throwable $e) {
            // Database may not be ready or migrated yet
        }
    }
}
