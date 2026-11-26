<?php

namespace App\Models;

use App\Traits\BelongsToBusiness;

use App\Traits\HasSyncUuid;
use Illuminate\Database\Eloquent\Model;

class PurchaseReturn extends Model
{
    use BelongsToBusiness, HasSyncUuid;

    protected $fillable = [
        'business_id','uuid'];
}
